import { NextRequest, NextResponse } from "next/server";
import { verifyPaystackTransaction } from "@/lib/paystack";
import { finalizePrincipalActivationFromPaystackData } from "@/lib/principal/payment";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const reference = String(searchParams.get("reference") ?? "").trim();
    if (!reference) {
      return NextResponse.json({ ok: false, error: "Missing reference" }, { status: 400 });
    }

    const data = await verifyPaystackTransaction(reference);
    if (String(data?.status ?? "").toLowerCase() !== "success") {
      return NextResponse.json(
        {
          ok: false,
          error: "Payment not successful yet.",
          data,
        },
        { status: 409 }
      );
    }

    const activation = await finalizePrincipalActivationFromPaystackData(data);
    return NextResponse.json({ ok: true, data: activation }, { status: 200 });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Failed to verify payment";
    return NextResponse.json({ ok: false, error: message }, { status: 400 });
  }
}
