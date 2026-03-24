import { NextResponse } from "next/server";
import { paystackHeaders } from "@/lib/paystack";
import { createAdminClient } from "@/lib/supabase/admin";
 
type PaidTier = "basic" | "pro";
 
const BASIC_ALLOWANCE = 20;
const PRO_ALLOWANCE = 50;
 
function normalizeTier(rawTier: unknown): PaidTier | null {
  const tier = String(rawTier ?? "").toLowerCase().trim();
  if (tier === "basic" || tier === "pro") return tier;
  return null;
}
 
function inferTierFromAmount(rawAmount: unknown, rawCurrency: unknown): PaidTier | null {
  const amount = Number(rawAmount);
  if (!Number.isFinite(amount) || amount <= 0) return null;
 
  const currency = String(rawCurrency ?? "NGN").toUpperCase();
 
  if (currency === "NGN") {
    if (amount >= 500000) return "pro";
    if (amount >= 200000) return "basic";
    return null;
  }
 
  if (currency === "USD") {
    if (amount >= 500) return "pro";
    if (amount >= 200) return "basic";
  }
 
  return null;
}
 
type PaystackVerifyData = {
  metadata?: {
    tier?: unknown;
  } | null;
  amount?: unknown;
  currency?: unknown;
};

async function resolveTierForUser(userId: string, data: PaystackVerifyData): Promise<PaidTier> {
  const admin = createAdminClient();
 
  const { data: existing } = await admin
    .from("profiles")
    .select("plan")
    .eq("id", userId)
    .maybeSingle();
 
  const fromMetadata = normalizeTier(data?.metadata?.tier);
  if (fromMetadata) return fromMetadata;
 
  const fromExisting = normalizeTier(existing?.plan);
  if (fromExisting) return fromExisting;
 
  const fromAmount = inferTierFromAmount(data?.amount, data?.currency);
  return fromAmount ?? "basic";
}
 
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const reference = String(searchParams.get("reference") ?? "").trim();
 
  if (!reference) {
    return NextResponse.json({ error: "Missing reference" }, { status: 400 });
  }
 
  const res = await fetch(`https://api.paystack.co/transaction/verify/${reference}`, {
    headers: paystackHeaders(),
  });
 
  const json = await res.json();
 
  if (!res.ok || !json?.status) {
    return NextResponse.json({ error: "Verify failed", details: json }, { status: 400 });
  }
 
  if (json?.data?.status === "success") {
    const userId = String(json?.data?.metadata?.user_id ?? "").trim();
 
    if (userId) {
      const tier = await resolveTierForUser(userId, json?.data);
      const allowance = tier === "pro" ? PRO_ALLOWANCE : BASIC_ALLOWANCE;
 
      const admin = createAdminClient();
      const { error } = await admin.from("profiles").upsert(
        {
          id: userId,
          plan: tier,
          pro_expires_at:
            tier === "pro"
              ? new Date(Date.now() + 32 * 24 * 60 * 60 * 1000).toISOString()
              : null,
          credits_balance: allowance,
          paystack_subscription_code: json?.data?.subscription?.subscription_code ?? null,
          paystack_customer_code: json?.data?.customer?.customer_code ?? null,
          paystack_email: json?.data?.customer?.email ?? null,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "id" }
      );
 
      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }
    }
  }
 
  return NextResponse.json({ ok: true, data: json.data });
}