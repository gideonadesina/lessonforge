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
import {
  getSchoolPlanSharedCredits,
  isValidSchoolPlanId,
  type SchoolPlanId,
} from "@/lib/billing/server-school-pricing";
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

function normalizeSchoolPlanId(rawPlan: unknown): SchoolPlanId | null {
  if (!isValidSchoolPlanId(rawPlan)) return null;
  return rawPlan as SchoolPlanId;
}

function normalizeMetadataSchoolPlan(
  metadata: Record<string, unknown>
): SchoolPlanId | null {
  const directPlan = normalizeSchoolPlanId(metadata?.plan_id ?? metadata?.plan);
  if (directPlan) return directPlan;

  const planName = String(metadata?.plan_name ?? "").trim().toLowerCase();
  return normalizeSchoolPlanId(planName ? `school_${planName}` : null);
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

async function getActiveSchoolCode(schoolId: string): Promise<string | null> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("school_codes")
    .select("code")
    .eq("school_id", schoolId)
    .eq("is_active", true)
    .maybeSingle();

  return data?.code ? String(data.code) : null;
}

function isUniqueViolation(error: unknown) {
  const err = error as { code?: string; message?: string } | null;
  return (
    String(err?.code ?? "") === "23505" ||
    String(err?.message ?? "").toLowerCase().includes("duplicate key")
  );
}

function generateSchoolLicenseCode() {
  const letters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  let prefix = "";
  for (let i = 0; i < 4; i += 1) {
    prefix += letters[crypto.randomInt(0, letters.length)];
  }

  return `${prefix}-${crypto.randomInt(0, 10000).toString().padStart(4, "0")}`;
}

function getPlanName(metadata: Record<string, unknown>, planId: SchoolPlanId) {
  const explicit = String(metadata?.plan_name ?? "").trim();
  if (explicit) return explicit;

  const rawPlan = String(metadata?.plan ?? metadata?.plan_id ?? planId).trim();
  return rawPlan.startsWith("school_") ? rawPlan.slice("school_".length) : rawPlan;
}

function getCredits(metadata: Record<string, unknown>, planId: SchoolPlanId) {
  const rawCredits =
    metadata?.credits ?? metadata?.shared_credits_allowance ?? metadata?.shared_credits;
  const credits = Number(rawCredits);
  return Number.isFinite(credits) && credits >= 0
    ? credits
    : getSchoolPlanSharedCredits(planId);
}

async function generateUniqueSchoolCode(
  admin: ReturnType<typeof createAdminClient>
) {
  for (let attempt = 0; attempt < 20; attempt += 1) {
    const code = generateSchoolLicenseCode();
    const [{ data: schoolCode }, { data: school }] = await Promise.all([
      admin.from("school_codes").select("code").eq("code", code).maybeSingle(),
      admin
        .from("schools")
        .select("id")
        .or(`code.eq.${code},license_code.eq.${code}`)
        .maybeSingle(),
    ]);

    if (!schoolCode?.code && !school?.id) return code;
  }

  throw new Error("Failed to generate a unique school code");
}

async function createOrResolveSchoolWorkspace(input: {
  principalId: string;
  planName: string;
  credits: number;
}) {
  const admin = createAdminClient();

  const { data: profile, error: profileError } = await admin
    .from("profiles")
    .select("full_name, school_id")
    .eq("id", input.principalId)
    .maybeSingle();

  if (profileError) {
    throw new Error(`Failed to load principal profile: ${profileError.message}`);
  }

  const existingSchoolId = String(profile?.school_id ?? "").trim();
  if (existingSchoolId) {
    const existingCode = await getActiveSchoolCode(existingSchoolId);
    if (existingCode) {
      await admin
        .from("profiles")
        .update({ app_role: "principal", plan: input.planName })
        .eq("id", input.principalId);

      return { schoolId: existingSchoolId, schoolCode: existingCode };
    }
  }

  const principalName = String(profile?.full_name ?? "").trim();
  const schoolName = principalName
    ? `${principalName}'s School`
    : "Principal's School";
  const now = new Date();
  const expiresAt = new Date(now);
  expiresAt.setFullYear(expiresAt.getFullYear() + 1);

  let lastError: unknown = null;
  for (let attempt = 0; attempt < 10; attempt += 1) {
    const schoolId = crypto.randomUUID();
    const code = await generateUniqueSchoolCode(admin);
    const timestamp = now.toISOString();

    const { error: schoolError } = await admin.from("schools").insert({
      id: schoolId,
      name: schoolName,
      license_code: code,
      max_seats: 999999,
      used_seats: 0,
      is_active: true,
      plan: input.planName,
      created_at: timestamp,
      code,
      updated_at: timestamp,
      shared_credits: input.credits,
      credits_used: 0,
      plan_type: input.planName,
      subscription_active: true,
      created_by: input.principalId,
      expires_at: expiresAt.toISOString(),
    });

    if (schoolError) {
      lastError = schoolError;
      if (isUniqueViolation(schoolError)) continue;
      throw new Error(`Failed to create school: ${schoolError.message}`);
    }

    const { error: profileUpdateError } = await admin
      .from("profiles")
      .update({
        school_id: schoolId,
        app_role: "principal",
        plan: input.planName,
      })
      .eq("id", input.principalId);

    if (profileUpdateError) {
      throw new Error(`Failed to update principal profile: ${profileUpdateError.message}`);
    }

    const { error: codeError } = await admin.from("school_codes").insert({
      school_id: schoolId,
      code,
    });

    if (codeError) {
      if (isUniqueViolation(codeError)) {
        lastError = codeError;
        continue;
      }
      throw new Error(`Failed to create school code: ${codeError.message}`);
    }

    return { schoolId, schoolCode: code };
  }

  const message = lastError instanceof Error ? lastError.message : "unknown error";
  throw new Error(`Failed to create school workspace: ${message}`);
}

export async function POST(req: Request) {
  try {
    const rawBody = await req.text();
    const signature = req.headers.get("x-paystack-signature");

    // Verify Paystack webhook signature
    if (!verifyPaystackSignature(rawBody, signature)) {
      console.warn("Webhook signature verification failed");
      return NextResponse.json(
        { received: false, error: "Invalid signature" },
        { status: 400 }
      );
    }

    const event = JSON.parse(rawBody);

    // Only process charge.success events
    if (event?.event !== "charge.success") {
      return NextResponse.json({ received: true }, { status: 200 });
    }

    const paystackData = event?.data ?? {};
    const metadata = (paystackData?.metadata ?? {}) as Record<string, unknown>;
    const metadataType = String(metadata?.type ?? "").trim();
    const purpose = metadata?.payment_purpose;

    if (metadataType === "school_plan" || purpose === "school") {
      const principalId = String(
        metadata?.principal_id ?? metadata?.user_id ?? ""
      ).trim();
      const planId = normalizeMetadataSchoolPlan(metadata);

      if (!principalId || !planId) {
        return NextResponse.json(
          { received: true, error: "Missing required school payment metadata" },
          { status: 200 }
        );
      }

      if (paystackData?.status !== "success") {
        return NextResponse.json(
          { received: true, warning: "Payment not successful" },
          { status: 200 }
        );
      }

      const planName = getPlanName(metadata, planId);
      const credits = getCredits(metadata, planId);
      const { schoolCode } = await createOrResolveSchoolWorkspace({
        principalId,
        planName,
        credits,
      });

      return NextResponse.json({
        success: true,
        type: "school_plan",
        school_code: schoolCode,
        plan: planName,
        credits,
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
      previousBalance: paymentResult.previousBalance,
      newBalance: paymentResult.newBalance,
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
