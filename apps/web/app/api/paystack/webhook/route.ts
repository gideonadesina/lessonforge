import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import crypto from "crypto";

export const runtime = "nodejs"; // Paystack signature verification needs Node crypto
type PaidTier = "basic" | "pro";

function verifyPaystackSignature(rawBody: string, signature: string | null) {
  const secret = process.env.PAYSTACK_SECRET_KEY;
  if (!secret || !signature) return false;

  const hash = crypto
    .createHmac("sha512", secret)
    .update(rawBody)
    .digest("hex");

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
  if (currency === "NGN") {
    // Paystack NGN amounts are typically in kobo.
    if (amount >= 500000) return "pro";
    if (amount >= 200000) return "basic";
    return null;
  }

  if (currency === "USD") {
    // Existing app config currently sends 500 (pro) / 200 (basic).
    if (amount >= 500) return "pro";
    if (amount >= 200) return "basic";
  }

  return null;
}

export async function POST(req: Request) {
  try {
    const rawBody = await req.text();
    const signature = req.headers.get("x-paystack-signature");

    // If signature is missing/invalid, reject
    if (!verifyPaystackSignature(rawBody, signature)) {
      return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
    }

    const event = JSON.parse(rawBody);

    // Minimal: handle successful charges (good enough for launch)
    if (event?.event === "charge.success") {
      const data = event?.data ?? {};
      const email = data?.customer?.email ?? null;
      const subscriptionCode = data?.subscription?.subscription_code ?? null;
      const customerCode = data?.customer?.customer_code ?? null;
      const userId = data?.metadata?.user_id ?? null;

      if (!userId) {
        return NextResponse.json(
          { received: true, warning: "Missing user_id in metadata" },
          { status: 200 }
        );
      }

      const admin = createAdminClient();
      const { data: existingProfile } = await admin
        .from("profiles")
        .select("plan, is_pro")
        .eq("id", userId)
        .maybeSingle();

      const tierFromMetadata = normalizeTier(data?.metadata?.tier);
      const tierFromExisting = normalizeTier(existingProfile?.plan);
      const tierFromAmount = inferTierFromAmount(data?.amount, data?.currency);

      // Priority: explicit checkout metadata > existing paid plan > amount heuristic > safe default.
      const tier: PaidTier =
        tierFromMetadata ?? tierFromExisting ?? tierFromAmount ?? "basic";
      const allowance = tier === "pro" ? 50 : 20;

      await admin
        .from("profiles")
        .update({
          plan: tier,
          is_pro: tier === "pro",
          credits_monthly_allowance: allowance,
          credits_balance: allowance,
          credits_reset_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
          paystack_email: email,
          paystack_subscription_code: subscriptionCode,
          paystack_customer_code: customerCode,
          updated_at: new Date().toISOString(),
        })
        .eq("id", userId);
    }

  } catch (error) {
    console.error("Webhook error:", error);
    return NextResponse.json({ error: "Webhook processing failed" }, { status: 500 });
  }
}
