import { NextResponse } from "next/server";
import { paystackHeaders } from "@/lib/paystack";
import { createAdminClient } from "@/lib/supabase/admin";

type PaidTier = "basic" | "pro";

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

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const reference = searchParams.get("reference");

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

  // If successful, also upgrade user as a backup (webhook is still primary)
  if (json?.data?.status === "success") {
    const user_id = json?.data?.metadata?.user_id as string | undefined;
    const email = json?.data?.customer?.email as string | undefined;
    const subscription_code = json?.data?.subscription?.subscription_code as string | undefined;
    const customer_code = json?.data?.customer?.customer_code as string | undefined;

    if (user_id) {
      const admin = createAdminClient();
      const { data: existingProfile } = await admin
        .from("profiles")
        .select("plan, is_pro")
        .eq("id", user_id)
        .maybeSingle();

      const tierFromMetadata = normalizeTier(json?.data?.metadata?.tier);
      const tierFromExisting = normalizeTier(existingProfile?.plan);
      const tierFromAmount = inferTierFromAmount(json?.data?.amount, json?.data?.currency);
      const plan = tierFromMetadata ?? tierFromExisting ?? tierFromAmount ?? "basic";
      const isPro = plan === "pro";

      await admin.from("profiles").upsert(
        {
          id: user_id,
          is_pro: isPro,
          pro_expires_at: isPro
            ? new Date(Date.now() + 32 * 24 * 60 * 60 * 1000).toISOString()
            : null,
          plan,
          paystack_subscription_code: subscription_code ?? null,
          paystack_customer_code: customer_code ?? null,
          paystack_email: email ?? null,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "id" }
      );
    }
  }

  return NextResponse.json({ ok: true, data: json.data });
}
