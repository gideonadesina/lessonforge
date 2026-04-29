/**
 * Server-side school payment processing utilities.
 * Handles idempotent shared credit grants from Paystack payments.
 */

import { createAdminClient } from "@/lib/supabase/admin";
import {
  getSchoolPlanPricing,
  getSchoolPlanSharedCredits,
  isValidSchoolPlanId,
  type SchoolPlanId,
} from "@/lib/billing/server-school-pricing";
import { generateSchoolCode, isMissingTableOrColumnError } from "@/lib/principal/utils";

export interface ProcessSchoolPaymentInput {
  reference: string;
  schoolId?: string | null;
  userId: string;
  plan: SchoolPlanId;
  schoolName?: string | null;
  principalName?: string | null;
  amount?: number | null;
  currency?: string | null;
  paystackCustomerCode?: string | null;
  paystackSubscriptionCode?: string | null;
  paystackEmail?: string | null;
  payerPayload?: unknown;
  flow?: string | null;
}

type ProcessSchoolPaymentPayload =
  | ProcessSchoolPaymentInput
  | {
      reference?: unknown;
      amount?: unknown;
      currency?: unknown;
      customer?: {
        customer_code?: unknown;
        email?: unknown;
      } | null;
      subscription?: {
        subscription_code?: unknown;
      } | null;
      metadata?: {
        user_id?: unknown;
        school_id?: unknown;
        plan_id?: unknown;
        plan?: unknown;
        school_name?: unknown;
        principal_name?: unknown;
      } | null;
      [key: string]: unknown;
    };

export interface ProcessSchoolPaymentResult {
  ok: boolean;
  reference: string;
  schoolId: string;
  plan: SchoolPlanId;
  sharedCreditsAwarded: number;
  previousBalance: number;
  newBalance: number;
  alreadyProcessed: boolean;
  error?: string;
}

function normalizeSchoolPlanId(rawPlan: unknown): SchoolPlanId | null {
  if (!isValidSchoolPlanId(rawPlan)) return null;
  return rawPlan as SchoolPlanId;
}

function normalizeInput(
  payload: ProcessSchoolPaymentPayload
): { ok: true; input: ProcessSchoolPaymentInput } | { ok: false; error: string } {
  const structured = payload as ProcessSchoolPaymentInput;

  if (structured?.reference && structured?.userId) {
    const reference = String(structured.reference).trim();
    const schoolId = String(structured.schoolId ?? "").trim() || null;
    const userId = String(structured.userId).trim();
    const plan = normalizeSchoolPlanId(structured.plan);

    if (!reference) return { ok: false, error: "Missing payment reference" };
    if (!userId) return { ok: false, error: "Missing user_id" };
    if (!plan) return { ok: false, error: "Missing or invalid school plan_id" };

    return {
      ok: true,
      input: {
        ...structured,
        reference,
        schoolId,
        userId,
        plan,
        schoolName: structured.schoolName ?? null,
        principalName: structured.principalName ?? null,
      },
    };
  }

  const paystackData = payload as ProcessSchoolPaymentPayload & {
    metadata?: Record<string, unknown> | null;
  };
  const metadata = paystackData?.metadata ?? {};
  const reference = String(paystackData?.reference ?? "").trim();
  const schoolId = String(metadata?.school_id ?? "").trim() || null;
  const userId = String(metadata?.user_id ?? "").trim();
  const plan = normalizeSchoolPlanId(metadata?.plan_id ?? metadata?.plan);
  const schoolName = String(metadata?.school_name ?? "").trim() || null;
  const principalName = String(metadata?.principal_name ?? "").trim() || null;

  if (!reference) return { ok: false, error: "Missing payment reference" };
  if (!userId) return { ok: false, error: "Missing user_id in metadata" };
  if (!plan) return { ok: false, error: "Missing or invalid school plan_id in metadata" };

 const ps = paystackData as any;

return {
  ok: true,
  input: {
    reference,
    schoolId,
    userId,
    plan,
    schoolName,
    principalName,
    amount: typeof paystackData?.amount === "number" ? paystackData.amount : null,
    currency: paystackData?.currency ? String(paystackData.currency) : null,
    paystackCustomerCode: String(ps?.customer?.customer_code ?? ""),
    paystackSubscriptionCode: String(
      ps?.subscription?.subscription_code ?? ""
    ),
    paystackEmail: String(ps?.customer?.email ?? ""),
    payerPayload: paystackData,
    flow: "school_webhook",
  },
};
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

async function insertSchoolWorkspace(
  input: {
    userId: string;
    schoolName?: string | null;
    principalName?: string | null;
  }
): Promise<string> {
  const admin = createAdminClient();
  const normalizedSchoolName =
    String(input.schoolName ?? "").trim() || "LessonForge School";
  const principalName = String(input.principalName ?? "").trim() || null;
  let schoolCode = generateSchoolCode(normalizedSchoolName);

  for (let attempt = 0; attempt < 5; attempt += 1) {
    const insertPayload: Record<string, unknown> = {
      name: normalizedSchoolName,
      created_by: input.userId,
      code: schoolCode,
      principal_name: principalName,
      shared_credits: 0,
      subscription_active: false,
    };

    let schoolRes = await admin
      .from("schools")
      .insert(insertPayload)
      .select("id")
      .maybeSingle();

    if (schoolRes.error && isMissingTableOrColumnError(schoolRes.error)) {
      schoolRes = await admin
        .from("schools")
        .insert({
          name: normalizedSchoolName,
          created_by: input.userId,
          code: schoolCode,
        })
        .select("id")
        .maybeSingle();
    }

    if (!schoolRes.error && schoolRes.data?.id) {
      const schoolId = String(schoolRes.data.id);
      let memberRes = await admin.from("school_members").insert({
        school_id: schoolId,
        user_id: input.userId,
        role: "principal",
        status: "active",
      });

      if (memberRes.error && isMissingTableOrColumnError(memberRes.error)) {
        memberRes = await admin.from("school_members").insert({
          school_id: schoolId,
          user_id: input.userId,
          role: "principal",
        });
      }

      if (memberRes.error && String((memberRes.error as any)?.code ?? "") !== "23505") {
        console.error("Failed to create principal school membership:", memberRes.error);
        throw new Error(`Failed to create principal membership: ${memberRes.error.message}`);
      }

      return schoolId;
    }

    if (schoolRes.error && String((schoolRes.error as any)?.code ?? "") === "23505") {
      schoolCode = generateSchoolCode(normalizedSchoolName);
      continue;
    }

    if (schoolRes.error) {
      console.error("Failed to create school workspace:", schoolRes.error);
      throw new Error(`Failed to create school workspace: ${schoolRes.error.message}`);
    }
  }

  throw new Error("Failed to create a unique school workspace");
}

async function resolveOrCreateSchoolWorkspace(input: ProcessSchoolPaymentInput): Promise<string> {
  const admin = createAdminClient();
  const existingSchoolId = String(input.schoolId ?? "").trim();
  if (existingSchoolId) return existingSchoolId;

  const { data: membership, error } = await admin
    .from("school_members")
    .select("school_id")
    .eq("user_id", input.userId)
    .eq("role", "principal")
    .maybeSingle();

  if (error && !isMissingTableOrColumnError(error)) {
    console.error("Failed to resolve principal school membership:", error);
    throw new Error(`Failed to resolve principal workspace: ${error.message}`);
  }

  const schoolId = String(membership?.school_id ?? "").trim();
  if (schoolId) return schoolId;

  return insertSchoolWorkspace(input);
}

/**
 * Create or return existing school payment transaction record.
 * Ensures idempotency by using reference as unique key.
 */
export async function recordSchoolPaymentTransaction(
  input: ProcessSchoolPaymentInput & { schoolId: string }
): Promise<{
  isNew: boolean;
  alreadyProcessed: boolean;
  sharedCreditsAwarded: number;
}> {
  const admin = createAdminClient();
  const now = new Date().toISOString();

  const existing = await getSchoolPaymentTransactionByReference(input.reference);
  if (existing) {
    return {
      isNew: false,
      alreadyProcessed: Boolean(existing.processed),
      sharedCreditsAwarded: Number(existing.shared_credits_awarded ?? 0),
    };
  }

  const sharedCreditsAwarded = getSchoolPlanSharedCredits(input.plan);

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
        };
      }
    }
    throw new Error(`Failed to record school payment: ${error.message}`);
  }

  return {
    isNew: true,
    alreadyProcessed: false,
    sharedCreditsAwarded,
  };
}

async function updateSchoolCreditsAtomic(
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
async function assignSchoolCreditsForPayment(
  schoolId: string,
  creditsToAssign: number
): Promise<{ previousBalance: number; newBalance: number }> {
  if (creditsToAssign <= 0) {
    throw new Error("Credits to assign must be positive");
  }

  return updateSchoolCreditsAtomic(schoolId, creditsToAssign);
}

async function ensureActiveSchoolCode(
  schoolId: string,
  userId: string
): Promise<string> {
  const admin = createAdminClient();
  const { data: existingCode, error: existingCodeError } = await admin
    .from("school_codes")
    .select("code")
    .eq("school_id", schoolId)
    .eq("is_active", true)
    .maybeSingle();

  if (existingCodeError) {
    throw new Error(`Failed to check existing school code: ${existingCodeError.message}`);
  }

  if (existingCode?.code) {
    return String(existingCode.code);
  }

  const { data: school, error: schoolError } = await admin
    .from("schools")
    .select("name")
    .eq("id", schoolId)
    .maybeSingle();

  if (schoolError) {
    throw new Error(`Failed to load school name: ${schoolError.message}`);
  }

  const schoolName = String(school?.name ?? "LessonForge School");

  for (let attempt = 0; attempt < 5; attempt += 1) {
    const code = generateSchoolCode(schoolName);
    const { error: insertCodeError } = await admin.from("school_codes").insert({
      code,
      school_id: schoolId,
      is_active: true,
      generated_by: userId,
    });

    if (!insertCodeError) {
      return code;
    }

    if ((insertCodeError as any)?.code === "23505") {
      continue;
    }

    throw new Error(`Failed to create school code: ${insertCodeError.message}`);
  }

  throw new Error("Failed to create a unique school code after retries");
}

/**
 * Mark payment transaction as processed and grant credits.
 */
async function markSchoolPaymentProcessed(
  reference: string,
  snapshot: {
    sharedCreditsAwarded: number;
    previousBalance: number;
    newBalance: number;
    schoolCode: string;
  }
) {
  const admin = createAdminClient();
  const now = new Date().toISOString();

  const { error } = await admin
    .from("school_payment_transactions")
    .update({
      processed: true,
      shared_credits_awarded_at: now,
      result_snapshot: snapshot,
      updated_at: now,
    })
    .eq("reference", reference);

  if (error) {
    throw new Error(`Failed to mark school payment processed: ${error.message}`);
  }

}

async function claimSchoolPaymentForProcessing(reference: string) {
  const admin = createAdminClient();
  const now = new Date().toISOString();

  const { data, error } = await admin
    .from("school_payment_transactions")
    .update({
      processed: true,
      processed_at: now,
      updated_at: now,
    })
    .eq("reference", reference)
    .eq("processed", false)
    .select("reference")
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to claim school payment for processing: ${error.message}`);
  }

  if (!data) {
    throw new Error("School payment has already been processed or is processing");
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
  payload: ProcessSchoolPaymentPayload
): Promise<ProcessSchoolPaymentResult> {
  const normalized = normalizeInput(payload);
  if (!normalized.ok) {
    return {
      ok: false,
      reference: "",
      schoolId: "",
      plan: "school_starter",
      sharedCreditsAwarded: 0,
      previousBalance: 0,
      newBalance: 0,
      alreadyProcessed: false,
      error: normalized.error,
    };
  }

  let input: ProcessSchoolPaymentInput & { schoolId: string };

  try {
    const schoolId = await resolveOrCreateSchoolWorkspace(normalized.input);
    input = { ...normalized.input, schoolId };

    // Check if already recorded
    const transaction = await recordSchoolPaymentTransaction(input);

    if (!transaction.isNew && transaction.alreadyProcessed) {
      const admin = createAdminClient();
      const [{ data: school }, { data: existingTransaction }] = await Promise.all([
        admin
          .from("schools")
          .select("shared_credits")
          .eq("id", input.schoolId)
          .maybeSingle(),
        admin
          .from("school_payment_transactions")
          .select("result_snapshot")
          .eq("reference", input.reference)
          .maybeSingle(),
      ]);
      const currentBalance = Math.max(0, Number(school?.shared_credits ?? 0));
      const snapshot = existingTransaction?.result_snapshot as
        | { previousBalance?: number; newBalance?: number }
        | null
        | undefined;

      // Already processed, return success without double-crediting
      return {
        ok: true,
        reference: input.reference,
        schoolId: input.schoolId,
        plan: input.plan,
        sharedCreditsAwarded: transaction.sharedCreditsAwarded,
        previousBalance:
          typeof snapshot?.previousBalance === "number"
            ? snapshot.previousBalance
            : Math.max(0, currentBalance - transaction.sharedCreditsAwarded),
        newBalance:
          typeof snapshot?.newBalance === "number"
            ? snapshot.newBalance
            : currentBalance,
        alreadyProcessed: true,
      };
    }

    const planPricing = getSchoolPlanPricing(input.plan);
    if (!planPricing) {
      throw new Error("Unable to resolve school plan pricing");
    }

    await claimSchoolPaymentForProcessing(input.reference);

    // Add credits to current purchase entitlement (no expiry)
    const balanceResult = await assignSchoolCreditsForPayment(
      input.schoolId,
      planPricing.sharedCredits
    );

    const schoolCode = await ensureActiveSchoolCode(input.schoolId, input.userId);

    const admin = createAdminClient();
    const now = new Date().toISOString();
    const { error: schoolUpdateError } = await admin
      .from("schools")
      .update({
        plan_type: input.plan,
        subscription_active: true,
        updated_at: now,
      })
      .eq("id", input.schoolId);

    if (schoolUpdateError) {
      throw new Error(`Failed to update school entitlement: ${schoolUpdateError.message}`);
    }

    // Mark as processed
    await markSchoolPaymentProcessed(
      input.reference,
      {
        sharedCreditsAwarded: planPricing.sharedCredits,
        previousBalance: balanceResult.previousBalance,
        newBalance: balanceResult.newBalance,
        schoolCode,
      }
    );

    return {
      ok: true,
      reference: input.reference,
      schoolId: input.schoolId,
      plan: input.plan,
      sharedCreditsAwarded: planPricing.sharedCredits,
      previousBalance: balanceResult.previousBalance,
      newBalance: balanceResult.newBalance,
      alreadyProcessed: false,
    };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "School payment processing failed";

    const fallback = normalizeInput(payload);
    const fallbackInput = fallback.ok ? fallback.input : null;

    if (
      fallbackInput &&
      fallbackInput.schoolId &&
      message.includes("already been processed or is processing")
    ) {
      const admin = createAdminClient();
      const [{ data: school }, { data: transaction }] = await Promise.all([
        admin
          .from("schools")
          .select("shared_credits")
          .eq("id", fallbackInput.schoolId)
          .maybeSingle(),
        admin
          .from("school_payment_transactions")
          .select("shared_credits_awarded, result_snapshot")
          .eq("reference", fallbackInput.reference)
          .maybeSingle(),
      ]);
      const sharedCreditsAwarded = Number(
        transaction?.shared_credits_awarded ??
          getSchoolPlanSharedCredits(fallbackInput.plan)
      );
      const currentBalance = Math.max(0, Number(school?.shared_credits ?? 0));
      const snapshot = transaction?.result_snapshot as
        | { previousBalance?: number; newBalance?: number }
        | null
        | undefined;

      return {
        ok: true,
        reference: fallbackInput.reference,
        schoolId: fallbackInput.schoolId,
        plan: fallbackInput.plan,
        sharedCreditsAwarded,
        previousBalance:
          typeof snapshot?.previousBalance === "number"
            ? snapshot.previousBalance
            : Math.max(0, currentBalance - sharedCreditsAwarded),
        newBalance:
          typeof snapshot?.newBalance === "number"
            ? snapshot.newBalance
            : currentBalance,
        alreadyProcessed: true,
      };
    }

    return {
      ok: false,
      reference: fallbackInput?.reference ?? "",
      schoolId: fallbackInput?.schoolId ?? "",
      plan: fallbackInput?.plan ?? "school_starter",
      sharedCreditsAwarded: 0,
      previousBalance: 0,
      newBalance: 0,
      alreadyProcessed: false,
      error: message,
    };
  }
}
