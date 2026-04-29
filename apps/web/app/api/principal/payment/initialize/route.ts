import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getBearerTokenFromHeaders, resolvePrincipalContext } from "@/lib/principal/server";
import { DEFAULT_CURRENCY } from "@/lib/principal/utils";
import { getSchoolPlanPaystackAmount } from "@/lib/billing/server-school-pricing";
import { appUrl, paystackHeaders } from "@/lib/paystack";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

type PrincipalPaymentInitPayload = {
  principalName: string;
  schoolName: string;
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

    const body = (await req.json().catch(() => null)) as PrincipalPaymentInitPayload | null;
    const principalName = String(body?.principalName ?? "").trim();
    const schoolName = String(body?.schoolName ?? "").trim();
    if (!principalName || !schoolName) {
      return NextResponse.json({ ok: false, error: "Principal name and school name are required." }, { status: 400 });
    }

    const amountMinor = getSchoolPlanPaystackAmount("school_starter", "NGN");
    if (!Number.isFinite(amountMinor) || amountMinor <= 0) {
      return NextResponse.json({ ok: false, error: "Invalid payment amount." }, { status: 400 });
    }

    const amount = amountMinor / 100;
    const email = context.user.email;
    if (!email) {
      return NextResponse.json({ ok: false, error: "Principal account email is required before payment." }, { status: 400 });
    }

    const admin = createAdminClient();
    await admin
      .from("profiles")
      .upsert(
        {
          id: context.user.id,
          paystack_email: email,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "id" }
      );

    const initializeRes = await fetch("https://api.paystack.co/transaction/initialize", {
      method: "POST",
      headers: paystackHeaders(),
      body: JSON.stringify({
        email,
        amount: amountMinor,
        currency: DEFAULT_CURRENCY,
        callback_url: appUrl("/principal?principalPaymentFlow=onboarding"),
        metadata: {
          purpose: "principal_onboarding",
          user_id: context.user.id,
          principal_name: principalName,
          school_name: schoolName,
          expected_amount_major: amount,
          expected_amount_minor: amountMinor,
          currency: DEFAULT_CURRENCY,
          school_id: context.school?.id ?? null,
          initiated_at: new Date().toISOString(),
        },
      }),
    });

    const json = await initializeRes.json();
    if (!initializeRes.ok || !json?.status || !json?.data?.authorization_url || !json?.data?.reference) {
      return NextResponse.json({ ok: false, error: "Paystack init failed", details: json }, { status: 400 });
    }

    return NextResponse.json(
      {
        ok: true,
        data: {
          authorization_url: String(json.data.authorization_url),
          reference: String(json.data.reference),
          amount,
          currency: DEFAULT_CURRENCY,
        },
      },
      { status: 200 }
    );
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Failed to initialize principal payment";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
