import { NextResponse } from "next/server";
import crypto from "crypto";
import {
  isValidTeacherPlanId,
  type TeacherPlanId,
} from "@/lib/billing/server-pricing";
import {
  processTeacherPayment,
  type ProcessPaymentInput,
} from "@/lib/billing/server-payment";
import { processSchoolPayment } from "@/lib/billing/server-school-payment";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

function verifyPaystackSignature(rawBody: string, signature: string | null) {
  const secret = process.env.PAYSTACK_SECRET_KEY;
  if (!secret || !signature) return false;

  const hash = crypto.createHmac("sha512", secret).update(rawBody).digest("hex");
  return hash === signature;
}

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
      // Manual one-time purchases: credits do not expire.
      pro_expires_at: null,
      paystack_subscription_code:
        paystackData?.subscription?.subscription_code ?? null,
      paystack_customer_code: paystackData?.customer?.customer_code ?? null,
      paystack_email: paystackData?.customer?.email ?? null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", userId);
}

export async function POST(req: Request) {
  try {
    const rawBody = await req.text();
    const signature = req.headers.get("x-paystack-signature");

    // Verify Paystack webhook signature
    if (!verifyPaystackSignature(rawBody, signature)) {
      console.warn("Webhook signature verification failed");
      return NextResponse.json(
        { received: true, warning: "Invalid signature" },
        { status: 200 }
      );
    }

    const event = JSON.parse(rawBody);

    // Only process charge.success events
    if (event?.event !== "charge.success") {
      return NextResponse.json({ received: true }, { status: 200 });
    }

    const paystackData = event?.data ?? {};
    const purpose = paystackData?.metadata?.payment_purpose;

    if (purpose === "school") {
      const schoolPaymentResult = await processSchoolPayment(paystackData);
      if (!schoolPaymentResult.ok) {
        console.error(
          `Webhook: school payment processing failed for reference ${String(
            paystackData?.reference ?? ""
          ).trim()}:`,
          schoolPaymentResult.error
        );
        return NextResponse.json(
          { received: true, error: schoolPaymentResult.error },
          { status: 200 }
        );
      }

      return NextResponse.json({
        received: true,
        reference: schoolPaymentResult.reference,
        schoolId: schoolPaymentResult.schoolId,
        sharedCreditsAwarded: schoolPaymentResult.sharedCreditsAwarded,
        alreadyProcessed: schoolPaymentResult.alreadyProcessed,
      });
    }

    const reference = String(paystackData?.reference ?? "").trim();
    const userId = String(paystackData?.metadata?.user_id ?? "").trim();

    // Validate required fields
    if (!reference) {
      console.warn("Webhook: missing payment reference");
      return NextResponse.json(
        { received: true, warning: "Missing reference" },
        { status: 200 }
      );
    }

    if (!userId) {
      console.warn("Webhook: missing user_id in metadata");
      return NextResponse.json(
        { received: true, warning: "Missing user_id" },
        { status: 200 }
      );
    }

    // Skip if not a success payment
    if (paystackData?.status !== "success") {
      console.warn(`Webhook: payment not successful for reference ${reference}`);
      return NextResponse.json(
        { received: true, warning: "Payment not successful" },
        { status: 200 }
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
      flow: "teacher_webhook",
    } as ProcessPaymentInput);

    if (!paymentResult.ok) {
      console.error(`Webhook: payment processing failed for reference ${reference}:`, paymentResult.error);
      // Return 200 anyway (webhook ack) but log the error
      return NextResponse.json({ received: true, error: paymentResult.error }, { status: 200 });
    }

    // Update profile metadata (plan, expiry, paystack codes)
    await updateProfileMetadata(userId, plan, paystackData);

    console.log(
      `Webhook: successfully processed payment ${reference} for user ${userId}, awarded ${paymentResult.creditsAwarded} credits`
    );

    return NextResponse.json({
      received: true,
      reference,
      creditsAwarded: paymentResult.creditsAwarded,
      alreadyProcessed: paymentResult.alreadyProcessed,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Webhook processing failed";
    console.error("Webhook error:", error);
    // Always return 200 for webhook acks (let Paystack know we received it)
    return NextResponse.json(
      { received: true, error: message },
      { status: 200 }
    );
  }
}