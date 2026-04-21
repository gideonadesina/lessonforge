import { NextResponse } from "next/server";
import { paystackHeaders } from "@/lib/paystack";
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
    const paymentPurpose = String(paystackData?.metadata?.payment_purpose ?? "")
      .toLowerCase()
      .trim();

    if (paymentPurpose !== "school") {
      return NextResponse.json(
        { error: "Payment reference is not a school payment" },
        { status: 400 }
      );
    }

    const userId = String(paystackData?.metadata?.user_id ?? "").trim();
    const schoolId = String(paystackData?.metadata?.school_id ?? "").trim();
    const planId = normalizeSchoolPlanId(paystackData?.metadata?.plan);

    if (!userId || !schoolId || !planId) {
      return NextResponse.json(
        {
          error:
            "Missing required payment metadata (user_id, school_id, or plan)",
        },
        { status: 400 }
      );
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
      flow: "school_verify",
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
      alreadyProcessed: paymentResult.alreadyProcessed,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "School payment verify failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
