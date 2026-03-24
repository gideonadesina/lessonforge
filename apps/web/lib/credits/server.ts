"use server";

import type { SupabaseClient } from "@supabase/supabase-js";

type ConsumeGenerationCreditRpcResult = {
  ok?: boolean;
  error?: string | null;
};

export type ConsumeGenerationCreditResult =
  | { ok: true }
  | { ok: false; error: string };

async function consumeCreditFromBalanceFallback(
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
      return { ok: false, error: `Credit check failed: ${profileError.message}` };
    }

    const currentBalance = Number(profile?.credits_balance ?? 0);
    if (!Number.isFinite(currentBalance) || currentBalance <= 0) {
      return { ok: false, error: "No credits" };
    }

    const { data: updatedRow, error: updateError } = await supabase
      .from("profiles")
      .update({
        credits_balance: currentBalance - 1,
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

  const fallbackResult = await consumeCreditFromBalanceFallback(supabase, userId);
  if (fallbackResult.ok) {
    return fallbackResult;
  }

  const rpcMessage = error?.message || String(rpcResult?.error ?? "").trim();
  if (rpcMessage && fallbackResult.error !== "No credits") {
    return { ok: false, error: `Credit check failed: ${rpcMessage}` };
  }

  return fallbackResult;
}

// Backward-compatible aliases for routes that use descriptive names.
export const consumeCreditSafely = consumeGenerationCredit;
export const consumeGenerationCreditWithFallback = consumeGenerationCredit;
