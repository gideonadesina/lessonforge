import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import crypto from "crypto";
import { verifyPaystackTransaction } from "@/lib/paystack";
import { finalizePrincipalActivationFromPaystackData, getPrincipalPaystackFlow } from "@/lib/principal/payment";

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

type LegacyPaystackData = {
  metadata?: { user_id?: string | null; tier?: "basic" | "pro" | null; flow?: string | null } | null;
  customer?: { email?: string | null; customer_code?: string | null } | null;
  subscription?: { subscription_code?: string | null } | null;
};

async function applyLegacyProfileUpgrade(data: LegacyPaystackData) {
  const email = data?.customer?.email ?? null;
  const subscriptionCode = data?.subscription?.subscription_code ?? null;
  const customerCode = data?.customer?.customer_code ?? null;
  const userId = data?.metadata?.user_id ?? null;
  const tier = (data?.metadata?.tier ?? "basic") as "basic" | "pro";

  if (!userId) {
    return;
  }

  const allowance = tier === "pro" ? 50 : 20;
  const admin = createAdminClient();

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

export async function POST(req: Request) {
  try {
    const rawBody = await req.text();
    const signature = req.headers.get("x-paystack-signature");

    // If signature is missing/invalid, reject
    if (!verifyPaystackSignature(rawBody, signature)) {
      return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
    }

    const event = JSON.parse(rawBody);

    if (event?.event === "charge.success") {
      const reference = String(event?.data?.reference ?? "").trim();
      if (!reference) {
        return NextResponse.json({ received: true, warning: "Missing payment reference" }, { status: 200 });
      }

      // Use reference verification as source of truth, even for webhook events.
      const verifiedData = await verifyPaystackTransaction(reference);
      const flow = String(verifiedData?.metadata?.flow ?? "");

      if (flow === getPrincipalPaystackFlow()) {
        await finalizePrincipalActivationFromPaystackData(verifiedData);
      } else {
        await applyLegacyProfileUpgrade(verifiedData);
      }
    }

    return NextResponse.json({ received: true }, { status: 200 });
  } catch (error) {
    console.error("Webhook error:", error);
    return NextResponse.json({ error: "Webhook processing failed" }, { status: 500 });
  }
}
