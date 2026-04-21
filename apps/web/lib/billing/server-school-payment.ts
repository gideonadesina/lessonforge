/**
 * Server-side school payment processing utilities.
 * Handles idempotent shared credit grants from Paystack payments.
 */

import { createAdminClient } from "@/lib/supabase/admin";
import {
  getSchoolPlanSharedCredits,
  getSchoolPlanTeacherLimit,
  type SchoolPlanId,
} from "@/lib/billing/server-school-pricing";
import { generateSchoolCode } from "@/lib/principal/utils";

export interface ProcessSchoolPaymentInput {
  reference: string;
  schoolId: string;
  userId: string;
  plan: SchoolPlanId;
  amount?: number | null;
  currency?: string | null;
  paystackCustomerCode?: string | null;
  paystackSubscriptionCode?: string | null;
  paystackEmail?: string | null;
  payerPayload?: unknown;
  flow?: string | null;
}

export interface ProcessSchoolPaymentResult {
  ok: boolean;
  reference: string;
  schoolId: string;
  plan: SchoolPlanId;
  sharedCreditsAwarded: number;
  teacherLimitAwarded: number;
  alreadyProcessed: boolean;
  error?: string;
}

/**
 * Get existing school payment transaction by reference.
 * Used for idempotency checks.
 */
export async function getSchoolPaymentTransactionByReference(reference: string) {
  const admin = createAdminClient();

  const { data, error } = await admin
    .from("school_payment_transactions")
    .select("*")
    .eq("reference", reference)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to check school payment transaction: ${error.message}`);
  }

  return data ?? null;
}

/**
 * Create or return existing school payment transaction record.
 * Ensures idempotency by using reference as unique key.
 */
export async function recordSchoolPaymentTransaction(
  input: ProcessSchoolPaymentInput
): Promise<{
  isNew: boolean;
  alreadyProcessed: boolean;
  sharedCreditsAwarded: number;
  teacherLimitAwarded: number;
}> {
  const admin = createAdminClient();
  const now = new Date().toISOString();

  const existing = await getSchoolPaymentTransactionByReference(input.reference);
  if (existing) {
    return {
      isNew: false,
      alreadyProcessed: Boolean(existing.processed),
      sharedCreditsAwarded: Number(existing.shared_credits_awarded ?? 0),
      teacherLimitAwarded: Number(existing.teacher_limit_awarded ?? 0),
    };
  }

  const sharedCreditsAwarded = getSchoolPlanSharedCredits(input.plan);
  const teacherLimitAwarded = getSchoolPlanTeacherLimit(input.plan);

  const { error } = await admin.from("school_payment_transactions").insert({
    reference: input.reference,
    school_id: input.schoolId,
    user_id: input.userId,
    provider: "paystack",
    flow: input.flow || null,
    plan: input.plan,
    amount: input.amount ?? null,
    currency: input.currency ? String(input.currency).toUpperCase() : null,
    status: "success",
    processed: false,
    processed_at: null,
    paystack_customer_code: input.paystackCustomerCode ?? null,
    paystack_subscription_code: input.paystackSubscriptionCode ?? null,
    paystack_email: input.paystackEmail ?? null,
    shared_credits_awarded: sharedCreditsAwarded,
    teacher_limit_awarded: teacherLimitAwarded,
    shared_credits_awarded_at: null,
    provider_payload: input.payerPayload ?? null,
    result_snapshot: null,
    created_at: now,
    updated_at: now,
  });

  if (error) {
    if ((error as any)?.code === "23505") {
      const retry = await getSchoolPaymentTransactionByReference(input.reference);
      if (retry) {
        return {
          isNew: false,
          alreadyProcessed: Boolean(retry.processed),
          sharedCreditsAwarded: Number(retry.shared_credits_awarded ?? 0),
          teacherLimitAwarded: Number(retry.teacher_limit_awarded ?? 0),
        };
      }
    }
    throw new Error(`Failed to record school payment: ${error.message}`);
  }

  return {
    isNew: true,
    alreadyProcessed: false,
    sharedCreditsAwarded,
    teacherLimitAwarded,
  };
}

async function ensureSchoolCodeExists(
  schoolId: string,
  generatedBy: string
): Promise<string> {
  const admin = createAdminClient();

  const { data: existingCode, error: existingCodeError } = await admin
    .from("school_codes")
    .select("code")
    .eq("school_id", schoolId)
    .eq("is_active", true)
    .maybeSingle();

  if (existingCodeError) {
    throw new Error(`Failed to check school code: ${existingCodeError.message}`);
  }

  const currentCode = String(existingCode?.code ?? "").trim();
  if (currentCode) {
    return currentCode;
  }

  const { data: school, error: schoolError } = await admin
    .from("schools")
    .select("name")
    .eq("id", schoolId)
    .maybeSingle();

  if (schoolError) {
    throw new Error(`Failed to load school for code generation: ${schoolError.message}`);
  }

  const schoolName = String(school?.name ?? "LessonForge School").trim() || "LessonForge School";

  for (let attempt = 0; attempt < 3; attempt += 1) {
    const newCode = String(generateSchoolCode(schoolName)).trim();
    if (!newCode) {
      throw new Error("Failed to generate school code");
    }

    const { error: insertCodeError } = await admin.from("school_codes").insert({
      code: newCode,
      school_id: schoolId,
      is_active: true,
      generated_by: generatedBy,
    });

    if (!insertCodeError) {
      return newCode;
    }

    if ((insertCodeError as any)?.code === "23505") {
      const { data: retryCode, error: retryCodeError } = await admin
        .from("school_codes")
        .select("code")
        .eq("school_id", schoolId)
        .eq("is_active", true)
        .maybeSingle();

      if (retryCodeError) {
        throw new Error(
          `Failed to load existing school code after conflict: ${retryCodeError.message}`
        );
      }

      const retryValue = String(retryCode?.code ?? "").trim();
      if (retryValue) {
        return retryValue;
      }

      continue;
    }

    throw new Error(`Failed to store school code: ${insertCodeError.message}`);
  }

  throw new Error("Failed to generate a unique school code after retries");
}

/**
 * Mark payment transaction as processed and grant credits.
 */
async function markSchoolPaymentProcessed(
  reference: string,
  schoolId: string,
  userId: string,
  plan: SchoolPlanId,
  sharedCreditsAwarded: number,
  teacherLimitAwarded: number
) {
  const admin = createAdminClient();
  const now = new Date().toISOString();

  // Keep this assignment deterministic by plan so repeated processing for the same
  // reference cannot stack credits.
  const { error: schoolUpdateError } = await admin
    .from("schools")
    .update({
      plan_type: plan,
      shared_credits: sharedCreditsAwarded,
      credits_used: 0,
      subscription_active: true,
      teacher_limit: teacherLimitAwarded,
      updated_at: now,
    })
    .eq("id", schoolId);

  if (schoolUpdateError) {
    throw new Error(`Failed to update school subscription: ${schoolUpdateError.message}`);
  }

  const schoolCode = await ensureSchoolCodeExists(schoolId, userId);

  const { error } = await admin
    .from("school_payment_transactions")
    .update({
      processed: true,
      processed_at: now,
      shared_credits_awarded_at: now,
      result_snapshot: {
        school_id: schoolId,
        plan,
        shared_credits: sharedCreditsAwarded,
        teacher_limit: teacherLimitAwarded,
        school_code: schoolCode,
      },
      updated_at: now,
    })
    .eq("reference", reference)
    .eq("school_id", schoolId);

  if (error) {
    throw new Error(`Failed to mark school payment processed: ${error.message}`);
  }
}

/**
 * Main entry point for processing school payment idempotently.
 * Guarantees:
 * - Same reference cannot grant credits twice
 * - School shared credits are set from plan allowance
 * - Either verify endpoint or webhook can run independently
 */
export async function processSchoolPayment(
  input: ProcessSchoolPaymentInput
): Promise<ProcessSchoolPaymentResult> {
  try {
    // Check if already recorded
    const transaction = await recordSchoolPaymentTransaction(input);

    if (!transaction.isNew && transaction.alreadyProcessed) {
      // Already processed, return success without double-crediting
      return {
        ok: true,
        reference: input.reference,
        schoolId: input.schoolId,
        plan: input.plan,
        sharedCreditsAwarded: transaction.sharedCreditsAwarded,
        teacherLimitAwarded: transaction.teacherLimitAwarded,
        alreadyProcessed: true,
      };
    }

    // Apply school subscription state and mark as processed
    await markSchoolPaymentProcessed(
      input.reference,
      input.schoolId,
      input.userId,
      input.plan,
      transaction.sharedCreditsAwarded,
      transaction.teacherLimitAwarded
    );

    return {
      ok: true,
      reference: input.reference,
      schoolId: input.schoolId,
      plan: input.plan,
      sharedCreditsAwarded: transaction.sharedCreditsAwarded,
      teacherLimitAwarded: transaction.teacherLimitAwarded,
      alreadyProcessed: false,
    };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "School payment processing failed";

    return {
      ok: false,
      reference: input.reference,
      schoolId: input.schoolId,
      plan: input.plan,
      sharedCreditsAwarded: 0,
      teacherLimitAwarded: 0,
      alreadyProcessed: false,
      error: message,
    };
  }
}
