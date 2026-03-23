import { NextResponse } from "next/server";
import { verifyPaystackTransaction } from "@/lib/paystack";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  finalizePrincipalActivationFromPaystackData,
  getPrincipalPaystackFlow,
} from "@/lib/principal/payment";
import {
  getBearerTokenFromHeaders,
  resolvePrincipalContext,
} from "@/lib/principal/server";
 
type PaidTier = "basic" | "pro";
 
type FinalizeInput = Parameters<
  typeof finalizePrincipalActivationFromPaystackData
>[0];
 
type VerifiedPaystackDataRaw = Omit<FinalizeInput, "amount"> & {
  amount?: number | string | null;
  reference?: string | null;
};
 
type ProfileRow = {
  id: string;
  email?: string | null;
  plan?: string | null;
  is_pro?: boolean | null;
};
 
type PaymentTransactionRow = {
  id: string;
  reference: string;
  user_id: string;
  provider: string;
  flow: string | null;
  tier: string | null;
  amount: number | null;
  currency: string | null;
  status: string;
  processed: boolean;
  processed_at: string | null;
  paystack_customer_code: string | null;
  paystack_subscription_code: string | null;
  paystack_email: string | null;
  provider_payload: unknown;
  result_snapshot: unknown | null;
  created_at: string;
  updated_at: string;
};
 
const BASIC_ALLOWANCE = 20;
const PRO_ALLOWANCE = 50;
const TRIAL_CREDITS = 3;
 
const BASIC_PRICE_KOBO = 200000; // ₦2,000
const PRO_PRICE_KOBO = 500000; // ₦5,000
const BASIC_PRICE_CENTS = 200; // $2.00
const PRO_PRICE_CENTS = 500; // $5.00
 
function jsonError(message: string, status = 400) {
  return NextResponse.json({ ok: false, error: message }, { status });
}
 
function getErrorMessage(error: unknown, fallback = "Verify failed") {
  if (error instanceof Error && error.message) return error.message;
  return fallback;
}
 
function normalizeTier(rawTier: unknown): PaidTier | null {
  const tier = String(rawTier ?? "").trim().toLowerCase();
  return tier === "basic" || tier === "pro" ? tier : null;
}
 
function normalizeTransactionData(rawData: VerifiedPaystackDataRaw): FinalizeInput {
  const rawAmount = rawData?.amount;
  const parsed = rawAmount == null ? null : Number(rawAmount);
 
  return {
    ...(rawData as object),
    amount: Number.isFinite(parsed) ? parsed : null,
  } as FinalizeInput;
}
 
function isSuccessfulPayment(data: FinalizeInput) {
  return String(data?.status ?? "").trim().toLowerCase() === "success";
}
 
function inferTierFromAmount(rawAmount: unknown, rawCurrency: unknown): PaidTier | null {
  const amount = Number(rawAmount);
  if (!Number.isFinite(amount) || amount <= 0) return null;
 
  const currency = String(rawCurrency ?? "NGN").trim().toUpperCase();
 
  if (currency === "NGN") {
    if (amount >= PRO_PRICE_KOBO) return "pro";
    if (amount >= BASIC_PRICE_KOBO) return "basic";
    return null;
  }
 
  if (currency === "USD") {
    if (amount >= PRO_PRICE_CENTS) return "pro";
    if (amount >= BASIC_PRICE_CENTS) return "basic";
    return null;
  }
 
  return null;
}
 
function toJson(value: unknown): unknown {
  try {
    return JSON.parse(JSON.stringify(value ?? null));
  } catch {
    return null;
  }
}
 
function buildProfileUpgradePatch(tier: PaidTier, data: FinalizeInput) {
  const allowance = tier === "pro" ? PRO_ALLOWANCE : BASIC_ALLOWANCE;
 
  return {
    plan: tier,
    is_pro: tier === "pro",
    credits_balance: allowance,
    credits_monthly_allowance: 0, // manual renewal mode
    credits_reset_at: null,
    free_credits: 0,
    pro_expires_at: null,
    paystack_subscription_code: data?.subscription?.subscription_code ?? null,
    paystack_customer_code: data?.customer?.customer_code ?? null,
    paystack_email: data?.customer?.email ?? null,
    updated_at: new Date().toISOString(),
  };
}
 
async function getExistingProfile(userId: string): Promise<ProfileRow | null> {
  const admin = createAdminClient();
 
  const { data, error } = await admin
    .from("profiles")
    .select("id, email, plan, is_pro")
    .eq("id", userId)
    .maybeSingle();
 
  if (error) throw new Error(error.message);
  return data as ProfileRow | null;
}
 
async function ensureProfileExists(userId: string, email: string | null) {
  const existing = await getExistingProfile(userId);
  if (existing) return existing;
 
  const admin = createAdminClient();
  const now = new Date().toISOString();
 
  const { data, error } = await admin
    .from("profiles")
    .insert({
      id: userId,
      email,
      paystack_email: email,
      plan: "free",
      is_pro: false,
      free_credits: TRIAL_CREDITS,
      credits_balance: TRIAL_CREDITS,
      credits_monthly_allowance: 0,
      credits_reset_at: null,
      pro_expires_at: null,
      updated_at: now,
    })
    .select("id, email, plan, is_pro")
    .single();
 
  if (error) {
    if ((error as { code?: string }).code === "23505") {
      const row = await getExistingProfile(userId);
      if (row) return row;
    }
    throw new Error(error.message);
  }
 
  return data as ProfileRow;
}
 
async function resolveTierForUser(
  userId: string,
  data: FinalizeInput
): Promise<PaidTier> {
  const existing = await getExistingProfile(userId);
 
  // priority: metadata -> amount -> existing plan -> is_pro -> fallback
  const fromMetadata = normalizeTier(data?.metadata?.tier);
  if (fromMetadata) return fromMetadata;
 
  const fromAmount = inferTierFromAmount(data?.amount, data?.currency);
  if (fromAmount) return fromAmount;
 
  const fromExistingPlan = normalizeTier(existing?.plan);
  if (fromExistingPlan) return fromExistingPlan;
 
  if (existing?.is_pro === true) return "pro";
 
  return "basic";
}
 
async function getPaymentTransactionByReference(reference: string) {
  const admin = createAdminClient();
 
  const { data, error } = await admin
    .from("payment_transactions")
    .select("*")
    .eq("reference", reference)
    .maybeSingle();
 
  if (error) throw new Error(error.message);
  return data as PaymentTransactionRow | null;
}
 
async function ensurePaymentTransaction(params: {
  reference: string;
  userId: string;
  data: FinalizeInput;
}) {
  const existing = await getPaymentTransactionByReference(params.reference);
  if (existing) {
    if (existing.user_id !== params.userId) {
      throw new Error("Payment reference does not belong to this user.");
    }
    return existing;
  }
 
  const admin = createAdminClient();
  const now = new Date().toISOString();
 
  const insertPayload = {
    reference: params.reference,
    user_id: params.userId,
    provider: "paystack",
    flow: String(params.data?.metadata?.flow ?? "").trim() || null,
    tier: normalizeTier(params.data?.metadata?.tier),
    amount: params.data?.amount ?? null,
    currency: params.data?.currency ? String(params.data.currency).toUpperCase() : null,
    status: "success", // this endpoint only continues after success check
    processed: false,
    processed_at: null,
    paystack_customer_code: params.data?.customer?.customer_code ?? null,
    paystack_subscription_code: params.data?.subscription?.subscription_code ?? null,
    paystack_email: params.data?.customer?.email ?? null,
    provider_payload: toJson(params.data),
    result_snapshot: null,
    updated_at: now,
  };
 
  const { data, error } = await admin
    .from("payment_transactions")
    .insert(insertPayload)
    .select("*")
    .single();
 
  if (error) {
    if ((error as { code?: string }).code === "23505") {
      const row = await getPaymentTransactionByReference(params.reference);
      if (row) {
        if (row.user_id !== params.userId) {
          throw new Error("Payment reference does not belong to this user.");
        }
        return row;
      }
    }
    throw new Error(error.message);
  }
 
  return data as PaymentTransactionRow;
}
 
async function markPaymentTransactionProcessed(params: {
  reference: string;
  userId: string;
  resultSnapshot: Record<string, unknown>;
  data: FinalizeInput;
}) {
  const admin = createAdminClient();
  const now = new Date().toISOString();
 
  const { data, error } = await admin
    .from("payment_transactions")
    .update({
      status: "success",
      processed: true,
      processed_at: now,
      paystack_customer_code: params.data?.customer?.customer_code ?? null,
      paystack_subscription_code: params.data?.subscription?.subscription_code ?? null,
      paystack_email: params.data?.customer?.email ?? null,
      provider_payload: toJson(params.data),
      result_snapshot: params.resultSnapshot,
      updated_at: now,
    })
    .eq("reference", params.reference)
    .eq("user_id", params.userId)
    .eq("processed", false)
    .select("*");
 
  if (error) throw new Error(error.message);
 
  if (!data || data.length === 0) {
    const existing = await getPaymentTransactionByReference(params.reference);
    if (!existing) {
      throw new Error("Payment transaction disappeared during processing");
    }
    return existing;
  }
 
  return data[0] as PaymentTransactionRow;
}
 
async function applyLegacyProfileUpgrade(userId: string, data: FinalizeInput) {
  if (!isSuccessfulPayment(data)) {
    throw new Error("Payment was not successful");
  }
 
  const tier = await resolveTierForUser(userId, data);
  const patch = buildProfileUpgradePatch(tier, data);
  const admin = createAdminClient();
 
  const { error } = await admin.from("profiles").update(patch).eq("id", userId);
  if (error) throw new Error(error.message);
 
  return {
    user_id: userId,
    tier,
    credits_balance: patch.credits_balance,
    credits_monthly_allowance: patch.credits_monthly_allowance,
    paystack_email: patch.paystack_email,
    paystack_customer_code: patch.paystack_customer_code,
    paystack_subscription_code: patch.paystack_subscription_code,
  };
}
 
export async function GET(req: Request) {
  try {
    const token = getBearerTokenFromHeaders(req.headers);
    const authContext = await resolvePrincipalContext(token);
 
    if (!authContext.ok || !authContext.user) {
      return jsonError(authContext.error ?? "Unauthorized", authContext.status ?? 401);
    }
 
    const { searchParams } = new URL(req.url);
    const reference = String(searchParams.get("reference") ?? "").trim();
    if (!reference) return jsonError("Missing reference", 400);
 
    const authenticatedUserId = authContext.user.id;
    const authenticatedEmail = authContext.user.email ?? null;
 
    const rawData = (await verifyPaystackTransaction(reference)) as VerifiedPaystackDataRaw;
    const data = normalizeTransactionData(rawData);
 
    if (!isSuccessfulPayment(data)) {
      return jsonError("Payment was not successful", 400);
    }
 
    const metadataUserId = String(data?.metadata?.user_id ?? "").trim();
    if (!metadataUserId) {
      return jsonError("Missing user_id in payment metadata.", 400);
    }
    if (metadataUserId !== authenticatedUserId) {
      return jsonError("Payment reference does not belong to this user.", 403);
    }
 
    await ensureProfileExists(authenticatedUserId, authenticatedEmail);
 
    const transaction = await ensurePaymentTransaction({
      reference,
      userId: authenticatedUserId,
      data,
    });
 
    if (transaction.processed) {
      return NextResponse.json(
        {
          ok: true,
          data: transaction.result_snapshot ?? { reference, already_processed: true },
        },
        { status: 200 }
      );
    }
 
    const flow = String(data?.metadata?.flow ?? "").trim();
    let resultSnapshot: Record<string, unknown>;
 
    if (flow === getPrincipalPaystackFlow()) {
      const activation = await finalizePrincipalActivationFromPaystackData(data);
      resultSnapshot = {
        type: "principal_activation",
        reference,
        activation: toJson(activation),
      } as Record<string, unknown>;
    } else {
      const upgrade = await applyLegacyProfileUpgrade(authenticatedUserId, data);
      resultSnapshot = {
        type: "legacy_profile_upgrade",
        reference,
        payment: toJson(data),
        upgrade: toJson(upgrade),
      } as Record<string, unknown>;
    }
 
    const processedTx = await markPaymentTransactionProcessed({
      reference,
      userId: authenticatedUserId,
      resultSnapshot,
      data,
    });
 
    return NextResponse.json(
      {
        ok: true,
        data: (processedTx.result_snapshot as Record<string, unknown> | null) ?? resultSnapshot,
      },
      { status: 200 }
    );
  } catch (error: unknown) {
    return jsonError(getErrorMessage(error, "Verify failed"), 400);
  }
}