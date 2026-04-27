import { NextResponse } from "next/server";
import { paystackHeaders } from "@/lib/paystack";
import { createClient } from "@supabase/supabase-js";
import {
  isValidSchoolPlanId,
  type SchoolPlanId,
} from "@/lib/billing/server-school-pricing";
import {
  processSchoolPayment,
  type ProcessSchoolPaymentInput,
} from "@/lib/billing/server-school-payment";

function normalizeSchoolPlanId(rawPlan: unknown): SchoolPlanId | null {
  if (!isValidSchoolPlanId(rawPlan)) return null;
  return rawPlan as SchoolPlanId;
}

export async function GET(req: Request) {
  try {
    const auth = req.headers.get("authorization") ?? "";
    const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
    if (!token) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userClient = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        auth: {
          persistSession: false,
          autoRefreshToken: false,
          detectSessionInUrl: false,
        },
        global: { headers: { Authorization: `Bearer ${token}` } },
      }
    );

    const {
      data: { user },
      error: authError,
    } = await userClient.auth.getUser();
    if (authError || !user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const reference = String(searchParams.get("reference") ?? "").trim();

    if (!reference) {
      return NextResponse.json({ error: "Missing reference" }, { status: 400 });
    }

    // Verify with Paystack
    const res = await fetch(
      `https://api.paystack.co/transaction/verify/${encodeURIComponent(reference)}`,
      {
        headers: paystackHeaders(),
      }
    );

    const json = await res.json();

    if (!res.ok || !json?.status) {
      return NextResponse.json(
        { error: "Verify failed", details: json },
        { status: 400 }
      );
    }

    if (json?.data?.status !== "success") {
      return NextResponse.json(
        { error: "Payment was not successful" },
        { status: 400 }
      );
    }

    const paystackData = json.data ?? {};
    const userId = String(paystackData?.metadata?.user_id ?? "").trim();
    const schoolId = String(paystackData?.metadata?.school_id ?? "").trim();
    const planId = normalizeSchoolPlanId(
      paystackData?.metadata?.plan_id ?? paystackData?.metadata?.plan
    );

    if (!userId || !schoolId || !planId) {
      return NextResponse.json(
        {
          error:
            "Missing required payment metadata (user_id, school_id, or plan)",
        },
        { status: 400 }
      );
    }

    if (user.id !== userId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Process payment with idempotency
    const paymentResult = await processSchoolPayment({
      reference,
      userId,
      schoolId,
      plan: planId,
      amount: paystackData?.amount,
      currency: paystackData?.currency,
      paystackCustomerCode: paystackData?.customer?.customer_code,
      paystackSubscriptionCode: paystackData?.subscription?.subscription_code,
      paystackEmail: paystackData?.customer?.email,
      payerPayload: paystackData,
      flow: "school_checkout",
    } as ProcessSchoolPaymentInput);

    if (!paymentResult.ok) {
      return NextResponse.json({ error: paymentResult.error }, { status: 500 });
    }

    // Return success
    return NextResponse.json({
      ok: true,
      reference,
      schoolId,
      plan: planId,
      sharedCreditsAwarded: paymentResult.sharedCreditsAwarded,
      teacherLimitAwarded: paymentResult.teacherLimitAwarded,
      previousBalance: paymentResult.previousBalance,
      newBalance: paymentResult.newBalance,
      alreadyProcessed: paymentResult.alreadyProcessed,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "School payment verify failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
