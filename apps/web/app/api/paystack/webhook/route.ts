import { NextResponse } from "next/server";
import { createAdminClient } from "../../../lib/supabase/admin";
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

      // If you passed user_id in metadata during initialize, use it:
      const userId = data?.metadata?.user_id ?? null;

      const admin = createAdminClient();

      if (userId) {
        await admin
          .from("profiles")
          .update({
            is_pro: true,
            plan: "pro_monthly",
            paystack_email: email,
            paystack_subscription_code: subscriptionCode,
            paystack_customer_code: customerCode,
          })
          .eq("id", userId);
      }
    }

    // Paystack expects 200
    return NextResponse.json({ received: true }, { status: 200 });
  } catch (e: any) {
    console.error("Paystack webhook error:", e);
    return NextResponse.json({ error: "Webhook error" }, { status: 500 });
  }
}
