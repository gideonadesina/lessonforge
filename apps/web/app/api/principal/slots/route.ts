import { NextRequest, NextResponse } from "next/server";
import { getBearerTokenFromHeaders, resolvePrincipalContext } from "@/lib/principal/server";
import { sanitizeSlotCount } from "@/lib/principal/utils";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

type SlotPayload = { addSlots: number };

export async function POST(req: NextRequest) {
  try {
    const token = getBearerTokenFromHeaders(req.headers);
    const context = await resolvePrincipalContext(token);

    if (!context.ok || !context.user) {
      return NextResponse.json({ ok: false, error: context.error ?? "Unauthorized" }, { status: context.status ?? 401 });
    }
    if (!context.school?.id || !context.isPrincipal) {
      return NextResponse.json({ ok: false, error: "Principal workspace not found." }, { status: 404 });
    }

    const body = (await req.json().catch(() => null)) as SlotPayload | null;
    const addSlots = sanitizeSlotCount(body?.addSlots ?? 1);

    return NextResponse.json(
      {
        ok: false,
        error:
          "Direct slot upgrades are disabled. Start a manual Paystack payment from the principal dashboard to renew or change slot count.",
        data: { requestedAdditionalSlots: addSlots },
      },
      { status: 400 }
    );
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Failed to update slots";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}