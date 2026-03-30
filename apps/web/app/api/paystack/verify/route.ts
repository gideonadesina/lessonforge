import { NextResponse } from "next/server";
import { paystackHeaders } from "@/lib/paystack";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  isValidTeacherPlanId,
  type TeacherPlanId,
} from "@/lib/billing/server-pricing";
import {
  processTeacherPayment,
  type ProcessPaymentInput,
} from "@/lib/billing/server-payment";

function normalizeTeacherPlanId(rawPlan: unknown): TeacherPlanId | null {
  if (!isValidTeacherPlanId(rawPlan)) return null;
  return rawPlan as TeacherPlanId;
}

async function resolvePlanForUser(userId: string, data: any): Promise<TeacherPlanId> {
  const admin = createAdminClient();

  const { data: existing } = await admin
    .from("profiles")
    .select("plan")
    .eq("id", userId)
    .maybeSingle();

  // Try to get plan from metadata first
  const fromMetadata = normalizeTeacherPlanId(data?.metadata?.plan);
  if (fromMetadata) return fromMetadata;

  // Fall back to existing plan in database
  const fromExisting = normalizeTeacherPlanId(existing?.plan);
  if (fromExisting) return fromExisting;

  // Default to basic if unable to determine
  return "basic";
}

/**
 * Update profile metadata and plan info after payment.
 * Separate from credit grant to avoid overwriting balance.
 */
async function updateProfileMetadata(
  userId: string,
  plan: TeacherPlanId,
  paystackData: any
) {
  const admin = createAdminClient();

  await admin
    .from("profiles")
    .update({
      plan,
      is_pro: plan !== "basic",
      pro_expires_at:
        plan !== "basic"
          ? new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
          : null,
      paystack_subscription_code:
        paystackData?.subscription?.subscription_code ?? null,
      paystack_customer_code: paystackData?.customer?.customer_code ?? null,
      paystack_email: paystackData?.customer?.email ?? null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", userId);
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
    const userId = String(paystackData?.metadata?.user_id ?? "").trim();

    if (!userId) {
      return NextResponse.json(
        { error: "Missing user_id in payment metadata" },
        { status: 400 }
      );
    }

    // Resolve the plan
    const plan = await resolvePlanForUser(userId, paystackData);

    // Process payment with idempotency
    const paymentResult = await processTeacherPayment({
      reference,
      userId,
      plan,
      amount: paystackData?.amount,
      currency: paystackData?.currency,
      paystackCustomerCode: paystackData?.customer?.customer_code,
      paystackSubscriptionCode: paystackData?.subscription?.subscription_code,
      paystackEmail: paystackData?.customer?.email,
      payerPayload: paystackData,
      flow: "teacher_checkout",
    } as ProcessPaymentInput);

    if (!paymentResult.ok) {
      return NextResponse.json(
        { error: paymentResult.error },
        { status: 500 }
      );
    }

    // Update profile metadata (plan, expiry, paystack codes)
    await updateProfileMetadata(userId, plan, paystackData);

    // Return success with credit info
    return NextResponse.json({
      ok: true,
      reference,
      userId,
      plan,
      creditsAwarded: paymentResult.creditsAwarded,
      previousBalance: paymentResult.previousBalance,
      newBalance: paymentResult.newBalance,
      alreadyProcessed: paymentResult.alreadyProcessed,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Verification failed";
    console.error("Paystack verify error:", error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}