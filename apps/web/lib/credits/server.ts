"use server";

import type { SupabaseClient } from "@supabase/supabase-js";

type ConsumeGenerationCreditRpcResult = {
  ok?: boolean;
  error?: string | null;
};

export type ConsumeGenerationCreditResult =
  | { ok: true }
  | { ok: false; error: string };

const NO_CREDITS_ERROR = "No credits";
const NO_SCHOOL_CREDITS_ERROR = "No school credits";

async function getTeacherSchoolId(
  supabase: SupabaseClient,
  userId: string
): Promise<{ schoolId: string | null; error?: string }> {
  const { data: profile, error } = await supabase
    .from("profiles")
    .select("school_id")
    .eq("id", userId)
    .maybeSingle();

  if (error) {
    return { schoolId: null, error: `Credit check failed: ${error.message}` };
  }

  const schoolId = String(profile?.school_id ?? "").trim();
  return { schoolId: schoolId || null };
}

async function consumeCreditFromSchoolFallback(
  supabase: SupabaseClient,
  schoolId: string,
  creditsToConsume: number
): Promise<ConsumeGenerationCreditResult> {
  // Compare-and-swap loop to avoid double spending during concurrent requests.
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const { data: school, error: schoolError } = await supabase
      .from("schools")
      .select("shared_credits")
      .eq("id", schoolId)
      .maybeSingle();

    if (schoolError) {
      return { ok: false, error: `Credit check failed: ${schoolError.message}` };
    }

    const currentBalance = Number(school?.shared_credits ?? 0);
    if (!Number.isFinite(currentBalance) || currentBalance < creditsToConsume) {
      return { ok: false, error: NO_SCHOOL_CREDITS_ERROR };
    }

    const { data: updatedRow, error: updateError } = await supabase
      .from("schools")
      .update({
        shared_credits: currentBalance - creditsToConsume,
        updated_at: new Date().toISOString(),
      })
      .eq("id", schoolId)
      .eq("shared_credits", currentBalance)
      .select("id")
      .maybeSingle();

    if (updateError) {
      return { ok: false, error: `Credit check failed: ${updateError.message}` };
    }

    if (updatedRow) {
      return { ok: true };
    }
  }

  return { ok: false, error: "Credit balance changed. Please retry." };
}

async function consumeCreditFromBalanceFallback(
  supabase: SupabaseClient,
  userId: string,
  creditsToConsume: number
): Promise<ConsumeGenerationCreditResult> {
  // Compare-and-swap loop to avoid double spending during concurrent requests.
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("credits_balance")
      .eq("id", userId)
      .maybeSingle();

    if (profileError) {
      return { ok: false, error: `Credit check failed: ${profileError.message}` };
    }

    const currentBalance = Number(profile?.credits_balance ?? 0);
    if (!Number.isFinite(currentBalance) || currentBalance < creditsToConsume) {
      return { ok: false, error: NO_CREDITS_ERROR };
    }

    const { data: updatedRow, error: updateError } = await supabase
      .from("profiles")
      .update({
        credits_balance: currentBalance - creditsToConsume,
        updated_at: new Date().toISOString(),
      })
      .eq("id", userId)
      .eq("credits_balance", currentBalance)
      .select("id")
      .maybeSingle();

    if (updateError) {
      return { ok: false, error: `Credit check failed: ${updateError.message}` };
    }

    if (updatedRow) {
      return { ok: true };
    }
  }

  return { ok: false, error: "Credit balance changed. Please retry." };
}

export async function consumeGenerationCredit(
  supabase: SupabaseClient,
  userId: string
): Promise<ConsumeGenerationCreditResult> {
  const { data, error } = await supabase.rpc("consume_generation_credit");
  const rpcResult = (data as ConsumeGenerationCreditRpcResult | null) ?? null;

  if (!error && rpcResult?.ok) {
    return { ok: true };
  }

  const schoolResult = await getTeacherSchoolId(supabase, userId);
  if (schoolResult.error) {
    return { ok: false, error: schoolResult.error };
  }

  let fallbackResult: ConsumeGenerationCreditResult;
  if (schoolResult.schoolId) {
    fallbackResult = await consumeCreditFromSchoolFallback(
      supabase,
      schoolResult.schoolId,
      1
    );
  } else {
    fallbackResult = await consumeCreditFromBalanceFallback(supabase, userId, 1);
  }

  if (fallbackResult.ok) {
    return fallbackResult;
  }

  const rpcMessage = error?.message || String(rpcResult?.error ?? "").trim();
  if (rpcMessage && fallbackResult.error !== NO_CREDITS_ERROR) {
    return { ok: false, error: `Credit check failed: ${rpcMessage}` };
  }

  if (
    fallbackResult.error &&
    fallbackResult.error !== NO_CREDITS_ERROR &&
    fallbackResult.error !== NO_SCHOOL_CREDITS_ERROR
  ) {
    return fallbackResult;
  }

  return { ok: false, error: NO_CREDITS_ERROR };
}

export async function consumeGenerationCredits(
  supabase: SupabaseClient,
  userId: string,
  creditsToConsume: number
): Promise<ConsumeGenerationCreditResult> {
  if (!Number.isFinite(creditsToConsume) || creditsToConsume <= 0) {
    return { ok: false, error: "Invalid credit amount" };
  }

  if (creditsToConsume === 1) {
    return consumeGenerationCredit(supabase, userId);
  }

  const schoolResult = await getTeacherSchoolId(supabase, userId);
  if (schoolResult.error) {
    return { ok: false, error: schoolResult.error };
  }

  if (schoolResult.schoolId) {
    const schoolDeduction = await consumeCreditFromSchoolFallback(
      supabase,
      schoolResult.schoolId,
      creditsToConsume
    );

    if (!schoolDeduction.ok) {
      if (
        schoolDeduction.error === NO_SCHOOL_CREDITS_ERROR ||
        schoolDeduction.error === NO_CREDITS_ERROR
      ) {
        return { ok: false, error: NO_CREDITS_ERROR };
      }
      return schoolDeduction;
    }

    return schoolDeduction;
  }

  return consumeCreditFromBalanceFallback(supabase, userId, creditsToConsume);
}

// Backward-compatible aliases for routes that use descriptive names.
export const consumeCreditSafely = consumeGenerationCredit;
export const consumeGenerationCreditWithFallback = consumeGenerationCredit;