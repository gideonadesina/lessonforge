import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import crypto from "crypto";

export const runtime = "nodejs"; // Paystack signature verification needs Node crypto

function verifyPaystackSignature(rawBody: string, signature: string | null) {
  const secret = process.env.PAYSTACK_SECRET_KEY;
  if (!secret || !signature) return false;

  const hash = crypto
    .createHmac("sha512", secret)
    .update(rawBody)
    .digest("hex");

  return hash === signature;
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

  // ✅ TRUST METADATA (YOU SET THIS IN INITIALIZE)
  const userId = data?.metadata?.user_id ?? null;
  const tier = (data?.metadata?.tier ?? "basic") as "basic" | "pro";

  if (!userId) {
    return NextResponse.json({ received: true, warning: "Missing user_id in metadata" }, { status: 200 });
  }

  const allowance = tier === "pro" ? 60 : 20;

  const admin = createAdminClient();

  await admin
    .from("profiles")
    .update({
      plan: tier,                                // "basic" | "pro"
      is_pro: tier === "pro",                    // ✅ only pro=true
      credits_monthly_allowance: allowance,      // ✅ 20 or 60
      credits_balance: allowance,                // ✅ reset to allowance on payment
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
