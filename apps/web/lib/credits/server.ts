"use server";

import type { SupabaseClient } from "@supabase/supabase-js";

export type ConsumeGenerationCreditResult =
  | { ok: true; beforeBalance: number; afterBalance: number }
  | { ok: false; error: string; beforeBalance: number | null; afterBalance: number | null };

export async function consumeGenerationCredit(
  supabase: SupabaseClient,
  userId: string
): Promise<ConsumeGenerationCreditResult> {
  // Compare-and-swap loop to avoid double spending during concurrent requests.
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("credits_balance")
      .eq("id", userId)
      .maybeSingle();

    if (profileError) {
      return {
        ok: false,
        error: `Credit check failed: ${profileError.message}`,
        beforeBalance: null,
        afterBalance: null,
      };
    }

    const currentBalance = Number(profile?.credits_balance ?? 0);
    if (!Number.isFinite(currentBalance) || currentBalance <= 0) {
      return {
        ok: false,
        error: "No credits",
        beforeBalance: Number.isFinite(currentBalance) ? currentBalance : null,
        afterBalance: Number.isFinite(currentBalance) ? currentBalance : null,
      };
    }

    const nextBalance = currentBalance - 1;
    const { data: updatedRow, error: updateError } = await supabase
      .from("profiles")
      .update({
        credits_balance: nextBalance,
        updated_at: new Date().toISOString(),
      })
      .eq("id", userId)
      .eq("credits_balance", currentBalance)
      .select("id")
      .maybeSingle();

    if (updateError) {
      return {
        ok: false,
        error: `Credit check failed: ${updateError.message}`,
        beforeBalance: currentBalance,
        afterBalance: currentBalance,
      };
    }

    if (updatedRow) {
      return { ok: true, beforeBalance: currentBalance, afterBalance: nextBalance };
    }
  }

  return {
    ok: false,
    error: "Credit balance changed. Please retry.",
    beforeBalance: null,
    afterBalance: null,
  };
}

// Backward-compatible aliases for routes that use descriptive names.
export const consumeCreditSafely = consumeGenerationCredit;
export const consumeGenerationCreditWithFallback = consumeGenerationCredit;
