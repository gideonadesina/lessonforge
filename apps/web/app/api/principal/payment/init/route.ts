import { NextRequest, NextResponse } from "next/server";
import { appUrl, paystackHeaders } from "@/lib/paystack";
import { getBearerTokenFromHeaders, resolvePrincipalContext } from "@/lib/principal/server";
import {
  getSchoolPlanPaystackAmount,
  isValidSchoolPlanId,
  type SchoolPlanId,
} from "@/lib/billing/server-school-pricing";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

type InitPrincipalPaymentPayload = {
  plan: SchoolPlanId;
};

export async function POST(req: NextRequest) {
  try {
    const token = getBearerTokenFromHeaders(req.headers);
    const context = await resolvePrincipalContext(token);
    if (!context.ok || !context.user) {
      return NextResponse.json({ ok: false, error: context.error ?? "Unauthorized" }, { status: context.status ?? 401 });
    }
    if (context.isTeacherOnly) {
      return NextResponse.json({ ok: false, error: "Teacher accounts cannot start principal billing." }, { status: 403 });
    }

    const body = (await req.json().catch(() => null)) as InitPrincipalPaymentPayload | null;
    const plan = body?.plan;
    if (!isValidSchoolPlanId(plan)) {
      return NextResponse.json({ ok: false, error: "Invalid school plan." }, { status: 400 });
    }

    if (!context.user.email) {
      return NextResponse.json({ ok: false, error: "User email is required for payment checkout." }, { status: 400 });
    }

    const amountMinor = getSchoolPlanPaystackAmount(plan, "NGN");
    if (!Number.isFinite(amountMinor) || amountMinor <= 0) {
      return NextResponse.json({ ok: false, error: "Invalid pricing for selected plan." }, { status: 500 });
    }

    const initResponse = await fetch("https://api.paystack.co/transaction/initialize", {
      method: "POST",
      headers: paystackHeaders(),
      body: JSON.stringify({
        email: context.user.email,
        amount: amountMinor,
        currency: "NGN",
        callback_url: appUrl("/payment/success?type=school"),
        metadata: {
          payment_purpose: "school",
          user_id: context.user.id,
          school_id: context.school?.id ?? null,
          school_name: context.school?.name ?? `School - ${context.user.email}`,
          plan_id: plan,
        },
      }),
      cache: "no-store",
    });

    const initJson = await initResponse.json();
    if (!initResponse.ok || !initJson?.status || !initJson?.data?.authorization_url || !initJson?.data?.reference) {
      return NextResponse.json(
        {
          ok: false,
          error: "Failed to initialize Paystack transaction.",
          details: initJson,
        },
        { status: 400 }
      );
    }

    return NextResponse.json(
      {
        ok: true,
        data: {
          reference: String(initJson.data.reference),
          authorizationUrl: String(initJson.data.authorization_url),
          accessCode: String(initJson.data.access_code ?? ""),
          plan,
          amountMinor,
          currency: "NGN",
        },
      },
      { status: 200 }
    );
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Failed to initialize principal payment";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
