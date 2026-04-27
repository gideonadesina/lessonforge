/**
 * Server-side teacher payment processing utilities.
 * Handles idempotent credit grants from Paystack payments.
 */

import { createAdminClient } from "@/lib/supabase/admin";
import { getPlanCredits, type TeacherPlanId } from "@/lib/billing/server-pricing";

const REFERRER_BONUS_CREDITS = 5;
const REFERRED_BONUS_CREDITS = 2;

export interface ProcessPaymentInput {
  reference: string;
  userId: string;
  plan: TeacherPlanId;
  amount?: number | null;
  currency?: string | null;
  paystackCustomerCode?: string | null;
  paystackSubscriptionCode?: string | null;
  paystackEmail?: string | null;
  payerPayload?: unknown;
  flow?: string | null;
}

export interface ProcessPaymentResult {
  ok: boolean;
  reference: string;
  userId: string;
  plan: TeacherPlanId;
  creditsAwarded: number;
  previousBalance: number;
  newBalance: number;
  alreadyProcessed: boolean;
  error?: string;
}

/**
 * Get existing payment transaction by reference.
 * Used for idempotency checks.
 */
export async function getPaymentTransactionByReference(reference: string) {
  const admin = createAdminClient();

  const { data, error } = await admin
    .from("teacher_payment_transactions")
    .select("*")
    .eq("reference", reference)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to check payment transaction: ${error.message}`);
  }

  return data ?? null;
}

/**
 * Safe credit increment: Get current balance, add credits, update atomically.
 * Uses compare-and-swap to prevent race conditions.
 */
async function incrementCreditsAtomic(
  userId: string,
  creditsToAdd: number,
  maxAttempts: number = 3
): Promise<{ previousBalance: number; newBalance: number }> {
  const admin = createAdminClient();

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const { data: profile, error: selectError } = await admin
      .from("profiles")
      .select("credits_balance")
      .eq("id", userId)
      .maybeSingle();

    if (selectError) {
      throw new Error(`Failed to read credits: ${selectError.message}`);
    }

    const previousBalance = Number(profile?.credits_balance ?? 0);
    if (!Number.isFinite(previousBalance)) {
      throw new Error("Invalid current balance");
    }

    const newBalance = previousBalance + creditsToAdd;

    const { data: updated, error: updateError } = await admin
      .from("profiles")
      .update({
        credits_balance: newBalance,
        updated_at: new Date().toISOString(),
      })
      .eq("id", userId)
      .eq("credits_balance", previousBalance)
      .select("credits_balance")
      .maybeSingle();

    if (updateError) {
      throw new Error(`Failed to update credits: ${updateError.message}`);
    }

    if (updated) {
      return { previousBalance, newBalance };
    }

    if (attempt === maxAttempts - 1) {
      throw new Error("Failed to update credits after retries (balance changed)");
    }
  }

  throw new Error("Unexpected: credit update failed");
}

/**
 * Create or return existing payment transaction record.
 * Ensures idempotency by using reference as unique key.
 */
export async function recordPaymentTransaction(
  input: ProcessPaymentInput
): Promise<{
  isNew: boolean;
  alreadyProcessed: boolean;
  creditsAwarded: number;
}> {
  const admin = createAdminClient();
  const now = new Date().toISOString();

  const existing = await getPaymentTransactionByReference(input.reference);
  if (existing) {
    return {
      isNew: false,
      alreadyProcessed: Boolean(existing.processed),
      creditsAwarded: Number(existing.credits_awarded ?? 0),
    };
  }

  const creditsAwarded = getPlanCredits(input.plan);

  const { error } = await admin.from("teacher_payment_transactions").insert({
    reference: input.reference,
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
    credits_awarded: creditsAwarded,
    credits_awarded_at: null,
    provider_payload: input.payerPayload ?? null,
    result_snapshot: null,
    created_at: now,
    updated_at: now,
  });

  if (error) {
    if ((error as any)?.code === "23505") {
      const retry = await getPaymentTransactionByReference(input.reference);
      if (retry) {
        return {
          isNew: false,
          alreadyProcessed: Boolean(retry.processed),
          creditsAwarded: Number(retry.credits_awarded ?? 0),
        };
      }
    }
    throw new Error(`Failed to record payment: ${error.message}`);
  }

  return {
    isNew: true,
    alreadyProcessed: false,
    creditsAwarded,
  };
}

/**
 * Apply referral rewards safely.
 * Rules:
 * - only if paying user has referred_by
 * - only once ever for that referred user
 * - only once for the specific payment reference
 * - prevents self-referral
 */
async function applyReferralRewardForFirstPayment(
  paymentReference: string,
  referredUserId: string
): Promise<void> {
  const admin = createAdminClient();

  // Prevent duplicate reward for same payment reference
  const { data: existingPaymentReward, error: existingPaymentRewardError } =
    await admin
      .from("referral_rewards")
      .select("id")
      .eq("payment_reference", paymentReference)
      .maybeSingle();

  if (existingPaymentRewardError) {
    throw new Error(
      `Failed to check referral reward by payment reference: ${existingPaymentRewardError.message}`
    );
  }

  if (existingPaymentReward) return;

  // Only reward on the referred user's FIRST rewarded payment
  const { data: existingUserReward, error: existingUserRewardError } = await admin
    .from("referral_rewards")
    .select("id")
    .eq("referred_user_id", referredUserId)
    .maybeSingle();

  if (existingUserRewardError) {
    throw new Error(
      `Failed to check existing referral reward for user: ${existingUserRewardError.message}`
    );
  }

  if (existingUserReward) return;

  // Get referred user's profile
  const { data: referredProfile, error: referredProfileError } = await admin
    .from("profiles")
    .select("id, referral_code, referred_by, credits_balance")
    .eq("id", referredUserId)
    .maybeSingle();

  if (referredProfileError) {
    throw new Error(
      `Failed to load referred user profile: ${referredProfileError.message}`
    );
  }

  const referredBy = String(referredProfile?.referred_by ?? "").trim().toUpperCase();
  if (!referredBy) return;

  const ownReferralCode = String(referredProfile?.referral_code ?? "")
    .trim()
    .toUpperCase();

  // Prevent self-referral
  if (ownReferralCode && ownReferralCode === referredBy) return;

  // Find referrer by referral_code
  const { data: referrerProfile, error: referrerProfileError } = await admin
    .from("profiles")
    .select("id, credits_balance, referral_code, referral_count")
    .eq("referral_code", referredBy)
    .maybeSingle();

  if (referrerProfileError) {
    throw new Error(
      `Failed to load referrer profile: ${referrerProfileError.message}`
    );
  }

  if (!referrerProfile?.id) return;
  if (referrerProfile.id === referredUserId) return;

  // Reward referrer
  await incrementCreditsAtomic(referrerProfile.id, REFERRER_BONUS_CREDITS);

  // Reward referred user
  await incrementCreditsAtomic(referredUserId, REFERRED_BONUS_CREDITS);

  // Increment referral count for referrer (best effort)
  const currentReferralCount = Number(referrerProfile.referral_count ?? 0);
  await admin
    .from("profiles")
    .update({
      referral_count: currentReferralCount + 1,
      updated_at: new Date().toISOString(),
    })
    .eq("id", referrerProfile.id);

  // Record reward to prevent duplicates
  const { error: insertRewardError } = await admin.from("referral_rewards").insert({
    referrer_user_id: referrerProfile.id,
    referred_user_id: referredUserId,
    payment_reference: paymentReference,
    referrer_credits: REFERRER_BONUS_CREDITS,
    referred_credits: REFERRED_BONUS_CREDITS,
  });

  if (insertRewardError) {
    // If duplicate due to race, ignore. Otherwise report.
    if ((insertRewardError as any)?.code !== "23505") {
      throw new Error(
        `Failed to record referral reward: ${insertRewardError.message}`
      );
    }
  }
}

/**
 * Mark payment transaction as processed and grant credits.
 * CRITICAL: This increments balance, never overwrites.
 */
export async function grantCreditsForPayment(
  reference: string,
  userId: string,
  plan: TeacherPlanId
): Promise<{
  previousBalance: number;
  newBalance: number;
  creditsAwarded: number;
}> {
  const admin = createAdminClient();
  const creditsAwarded = getPlanCredits(plan);
  const now = new Date().toISOString();

  const { data: claimed, error: claimError } = await admin
    .from("teacher_payment_transactions")
    .update({
      processed: true,
      processed_at: now,
      updated_at: now,
    })
    .eq("reference", reference)
    .eq("user_id", userId)
    .eq("processed", false)
    .select("reference")
    .maybeSingle();

  if (claimError) {
    throw new Error(`Failed to claim payment for processing: ${claimError.message}`);
  }

  if (!claimed) {
    throw new Error("Payment has already been processed or is processing");
  }

  const { previousBalance, newBalance } = await incrementCreditsAtomic(
    userId,
    creditsAwarded
  );

  const { error: updateError } = await admin
    .from("teacher_payment_transactions")
    .update({
      processed: true,
      credits_awarded_at: now,
      result_snapshot: {
        creditsAwarded,
        previousBalance,
        newBalance,
      },
      updated_at: now,
    })
    .eq("reference", reference)
    .eq("user_id", userId);

  if (updateError) {
    console.error(
      `Warning: Failed to mark payment as processed after crediting. Reference: ${reference}`,
      updateError
    );
  }

  // Apply referral reward after successful processing
  try {
    await applyReferralRewardForFirstPayment(reference, userId);
  } catch (referralError) {
    console.error(
      `Referral reward processing failed for payment ${reference}:`,
      referralError
    );
    // Do not throw — teacher payment already succeeded
  }

  return {
    previousBalance,
    newBalance,
    creditsAwarded,
  };
}

/**
 * Complete payment processing with idempotency.
 * Single entry point for both verify endpoint and webhook.
 */
export async function processTeacherPayment(
  input: ProcessPaymentInput
): Promise<ProcessPaymentResult> {
  try {
    const transactionRecord = await recordPaymentTransaction(input);

    if (!transactionRecord.isNew && transactionRecord.alreadyProcessed) {
      const admin = createAdminClient();
      const [{ data: profile }, { data: transaction }] = await Promise.all([
        admin
        .from("profiles")
        .select("credits_balance")
        .eq("id", input.userId)
          .maybeSingle(),
        admin
          .from("teacher_payment_transactions")
          .select("result_snapshot")
          .eq("reference", input.reference)
          .maybeSingle(),
      ]);

      const newBalance = Number(profile?.credits_balance ?? 0);
      const snapshot = transaction?.result_snapshot as
        | { previousBalance?: number; newBalance?: number }
        | null
        | undefined;

      return {
        ok: true,
        reference: input.reference,
        userId: input.userId,
        plan: input.plan,
        creditsAwarded: transactionRecord.creditsAwarded,
        previousBalance:
          typeof snapshot?.previousBalance === "number"
            ? snapshot.previousBalance
            : Math.max(0, newBalance - transactionRecord.creditsAwarded),
        newBalance:
          typeof snapshot?.newBalance === "number" ? snapshot.newBalance : newBalance,
        alreadyProcessed: true,
      };
    }

    const creditResult = await grantCreditsForPayment(
      input.reference,
      input.userId,
      input.plan
    );

    return {
      ok: true,
      reference: input.reference,
      userId: input.userId,
      plan: input.plan,
      creditsAwarded: creditResult.creditsAwarded,
      previousBalance: creditResult.previousBalance,
      newBalance: creditResult.newBalance,
      alreadyProcessed: false,
    };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Payment processing failed";
    if (message.includes("already been processed or is processing")) {
      const admin = createAdminClient();
      const [{ data: profile }, { data: transaction }] = await Promise.all([
        admin
          .from("profiles")
          .select("credits_balance")
          .eq("id", input.userId)
          .maybeSingle(),
        admin
          .from("teacher_payment_transactions")
          .select("credits_awarded, result_snapshot")
          .eq("reference", input.reference)
          .maybeSingle(),
      ]);
      const creditsAwarded = Number(
        transaction?.credits_awarded ?? getPlanCredits(input.plan)
      );
      const currentBalance = Math.max(0, Number(profile?.credits_balance ?? 0));
      const snapshot = transaction?.result_snapshot as
        | { previousBalance?: number; newBalance?: number }
        | null
        | undefined;

      return {
        ok: true,
        reference: input.reference,
        userId: input.userId,
        plan: input.plan,
        creditsAwarded,
        previousBalance:
          typeof snapshot?.previousBalance === "number"
            ? snapshot.previousBalance
            : Math.max(0, currentBalance - creditsAwarded),
        newBalance:
          typeof snapshot?.newBalance === "number"
            ? snapshot.newBalance
            : currentBalance,
        alreadyProcessed: true,
      };
    }

    return {
      ok: false,
      reference: input.reference,
      userId: input.userId,
      plan: input.plan,
      creditsAwarded: 0,
      previousBalance: 0,
      newBalance: 0,
      alreadyProcessed: false,
      error: message,
    };
  }
}
