import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import crypto from "crypto";
 
export const runtime = "nodejs";
 
type PaidTier = "basic" | "pro";
 
const BASIC_ALLOWANCE = 20;
const PRO_ALLOWANCE = 50;
 
function verifyPaystackSignature(rawBody: string, signature: string | null) {
  const secret = process.env.PAYSTACK_SECRET_KEY;
  if (!secret || !signature) return false;
 
  const hash = crypto.createHmac("sha512", secret).update(rawBody).digest("hex");
  return hash === signature;
}
 
function normalizeTier(rawTier: unknown): PaidTier | null {
  const tier = String(rawTier ?? "").toLowerCase().trim();
  if (tier === "basic" || tier === "pro") return tier;
  return null;
}
 
function inferTierFromAmount(rawAmount: unknown, rawCurrency: unknown): PaidTier | null {
  const amount = Number(rawAmount);
  if (!Number.isFinite(amount) || amount <= 0) return null;
 
  const currency = String(rawCurrency ?? "NGN").toUpperCase();
 
  // Your current initialize pricing:
  // NGN => basic: 200000, pro: 500000
  // USD => basic: 200, pro: 500
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
 
async function resolveTierForUser(userId: string, data: any): Promise<PaidTier> {
  const admin = createAdminClient();
 
  const { data: existing } = await admin
    .from("profiles")
    .select("plan, is_pro")
    .eq("id", userId)
    .maybeSingle();
 
  const fromMetadata = normalizeTier(data?.metadata?.tier);
  if (fromMetadata) return fromMetadata;
 
  const fromExisting = normalizeTier(existing?.plan);
  if (fromExisting) return fromExisting;
 
  if (existing?.is_pro === true) return "pro";
 
  const fromAmount = inferTierFromAmount(data?.amount, data?.currency);
  return fromAmount ?? "basic";
}
 
export async function POST(req: Request) {
  try {
    const rawBody = await req.text();
    const signature = req.headers.get("x-paystack-signature");
 
    if (!verifyPaystackSignature(rawBody, signature)) {
      return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
    }
 
    const event = JSON.parse(rawBody);
 
    if (event?.event === "charge.success") {
      const data = event?.data ?? {};
      const userId = String(data?.metadata?.user_id ?? "").trim();
 
      if (!userId) {
        return NextResponse.json(
          { received: true, warning: "Missing user_id in metadata" },
          { status: 200 }
        );
      }
 
      const tier = await resolveTierForUser(userId, data);
      const allowance = tier === "pro" ? PRO_ALLOWANCE : BASIC_ALLOWANCE;
 
      const admin = createAdminClient();
      const { error } = await admin
        .from("profiles")
        .update({
          plan: tier,
          is_pro: tier === "pro",
          pro_expires_at:
            tier === "pro"
              ? new Date(Date.now() + 32 * 24 * 60 * 60 * 1000).toISOString()
              : null,
          credits_monthly_allowance: allowance,
          credits_balance: allowance,
          credits_reset_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
          paystack_email: data?.customer?.email ?? null,
          paystack_subscription_code: data?.subscription?.subscription_code ?? null,
          paystack_customer_code: data?.customer?.customer_code ?? null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", userId);
 
      if (error) {
        console.error("Webhook profile update error:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
      }
    }
 
    return NextResponse.json({ received: true }, { status: 200 });
  } catch (error) {
    console.error("Webhook error:", error);
    return NextResponse.json({ error: "Webhook processing failed" }, { status: 500 });
  }
 }