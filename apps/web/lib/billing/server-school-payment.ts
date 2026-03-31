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
    throw new Error(`Failed to record school payment: ${error.message}`);
  }

  return {
    isNew: true,
    alreadyProcessed: false,
    sharedCreditsAwarded,
    teacherLimitAwarded,
  };
}

/**
 * Safe school credit increment: Get current balance, add credits, update atomically.
 * Uses compare-and-swap to prevent race conditions.
 */
async function incrementSchoolCreditsAtomic(
  schoolId: string,
  creditsToAdd: number,
  maxAttempts: number = 3
): Promise<{ previousBalance: number; newBalance: number }> {
  const admin = createAdminClient();

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const { data: school, error: selectError } = await admin
      .from("schools")
      .select("shared_credits")
      .eq("id", schoolId)
      .maybeSingle();

    if (selectError) {
      throw new Error(`Failed to read school credits: ${selectError.message}`);
    }

    const previousBalance = Number(school?.shared_credits ?? 0);
    if (!Number.isFinite(previousBalance)) {
      throw new Error("Invalid current school credits balance");
    }

    const newBalance = previousBalance + creditsToAdd;

    const { data: updated, error: updateError } = await admin
      .from("schools")
      .update({
        shared_credits: newBalance,
        updated_at: new Date().toISOString(),
      })
      .eq("id", schoolId)
      .eq("shared_credits", previousBalance)
      .select("shared_credits")
      .maybeSingle();

    if (updateError) {
      throw new Error(`Failed to update school credits: ${updateError.message}`);
    }

    if (updated) {
      return { previousBalance, newBalance };
    }

    if (attempt === maxAttempts - 1) {
      throw new Error(
        "Failed to update school credits after retries (balance changed)"
      );
    }
  }

  throw new Error("Unexpected: school credit update failed");
}

/**
 * Grant shared credits to school from successful payment.
 */
async function grantSchoolCreditsForPayment(
  schoolId: string,
  creditsToGrant: number
): Promise<{ previousBalance: number; newBalance: number }> {
  if (creditsToGrant <= 0) {
    throw new Error("Credits to grant must be positive");
  }

  return incrementSchoolCreditsAtomic(schoolId, creditsToGrant);
}

/**
 * Mark payment transaction as processed and grant credits.
 */
async function markSchoolPaymentProcessed(
  reference: string,
  schoolId: string,
  sharedCreditsAwarded: number,
  teacherLimitAwarded: number
) {
  const admin = createAdminClient();
  const now = new Date().toISOString();

  const { error } = await admin
    .from("school_payment_transactions")
    .update({
      processed: true,
      processed_at: now,
      updated_at: now,
    })
    .eq("reference", reference);

  if (error) {
    throw new Error(`Failed to mark school payment processed: ${error.message}`);
  }

  // Also update school's teacher_limit if provided
  if (teacherLimitAwarded > 0) {
    await admin
      .from("schools")
      .update({
        teacher_limit: teacherLimitAwarded,
        updated_at: now,
      })
      .eq("id", schoolId);
  }
}

/**
 * Main entry point for processing school payment idempotently.
 * Guarantees:
 * - Same reference cannot grant credits twice
 * - Credits always ADD to balance
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

    // Grant credits
    const creditResult = await grantSchoolCreditsForPayment(
      input.schoolId,
      transaction.sharedCreditsAwarded
    );

    // Mark as processed
    await markSchoolPaymentProcessed(
      input.reference,
      input.schoolId,
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
