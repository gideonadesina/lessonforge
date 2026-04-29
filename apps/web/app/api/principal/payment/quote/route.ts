import { NextRequest, NextResponse } from "next/server";
import { getBearerTokenFromHeaders, resolvePrincipalContext } from "@/lib/principal/server";
import { DEFAULT_CURRENCY } from "@/lib/principal/utils";
import { getSchoolPlanPricing } from "@/lib/billing/server-school-pricing";

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

    await req.json().catch(() => ({}));
    const plan = getSchoolPlanPricing("school_starter");
    const amount = plan?.priceNaira ?? 0;

    return NextResponse.json(
      {
        ok: true,
        data: {
          amount,
          currency: DEFAULT_CURRENCY,
          billingCycle: "monthly",
         renewalMode: "manual",
          provider: "paystack",
          reference: null,
          
        },
      },
      { status: 200 }
    );
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Failed to build quote";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
