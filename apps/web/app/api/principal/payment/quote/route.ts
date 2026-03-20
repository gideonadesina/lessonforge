import { NextRequest, NextResponse } from "next/server";
import { getBearerTokenFromHeaders, resolvePrincipalContext } from "@/lib/principal/server";
import { DEFAULT_CURRENCY, DEFAULT_SLOT_PRICE, computeSubscriptionAmount, sanitizeSlotCount } from "@/lib/principal/utils";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function POST(req: NextRequest) {
  try {
    const token = getBearerTokenFromHeaders(req.headers);
    const context = await resolvePrincipalContext(token);
    if (!context.ok) {
      return NextResponse.json({ ok: false, error: context.error ?? "Unauthorized" }, { status: context.status ?? 401 });
    }
    if (context.isTeacherOnly) {
      return NextResponse.json({ ok: false, error: "Teacher accounts cannot start principal billing." }, { status: 403 });
    }

    const body = await req.json().catch(() => ({}));
    const teacherSlots = sanitizeSlotCount(body?.teacherSlots ?? 1);
    const amount = computeSubscriptionAmount(teacherSlots, DEFAULT_SLOT_PRICE);

    return NextResponse.json(
      {
        ok: true,
        data: {
          teacherSlots,
          slotPrice: DEFAULT_SLOT_PRICE,
          amount,
          currency: DEFAULT_CURRENCY,
          billingCycle: "monthly",
          provider: "paystack",
        },
      },
      { status: 200 }
    );
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Failed to build quote";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}