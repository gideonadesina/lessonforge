import { NextRequest, NextResponse } from "next/server";
import { verifyPaystackTransaction } from "@/lib/paystack";
import { finalizePrincipalActivationFromPaystackData } from "@/lib/principal/payment";
import { getBearerTokenFromHeaders, resolvePrincipalContext } from "@/lib/principal/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(req: NextRequest) {
  try {
    const token = getBearerTokenFromHeaders(req.headers);
    const context = await resolvePrincipalContext(token);
    if (!context.ok || !context.user) {
      return NextResponse.json({ ok: false, error: context.error ?? "Unauthorized" }, { status: context.status ?? 401 });
    }

    const { searchParams } = new URL(req.url);
    const reference = String(searchParams.get("reference") ?? "").trim();
    if (!reference) {
      return NextResponse.json({ ok: false, error: "Missing reference" }, { status: 400 });
    }

    const data = await verifyPaystackTransaction(reference);
    const paystackUserId = String(data?.metadata?.user_id ?? "").trim();
    if (paystackUserId && paystackUserId !== context.user.id) {
      return NextResponse.json({ ok: false, error: "Payment reference does not belong to this user." }, { status: 403 });
    }

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
