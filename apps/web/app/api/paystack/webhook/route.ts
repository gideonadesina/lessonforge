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

    if (event?.event !== "charge.success") {
      return NextResponse.json({ received: true }, { status: 200 });
    }

    const data = event?.data ?? {};
    const metadata = (data?.metadata ?? {}) as Record<string, unknown>;
    const purpose = String(metadata?.purpose ?? "");

    // Webhook currently finalizes only teacher one-off/manual payments.
    if (purpose !== "teacher_plan_purchase") {
      return NextResponse.json({ received: true }, { status: 200 });
    }

    const userId = String(metadata?.user_id ?? "");
    if (!userId) {
      return NextResponse.json({ received: true, warning: "Missing user_id in metadata" }, { status: 200 });
    }

    const reference = String(data?.reference ?? "");
    const tier = String(metadata?.tier ?? "").toLowerCase() === "pro" ? "pro" : "basic";
    const currency = (String(data?.currency ?? "NGN").toUpperCase() === "USD" ? "USD" : "NGN") as "NGN" | "USD";
    const configuredAmountMajor =
      tier === "pro"
        ? Number(currency === "NGN" ? process.env.TEACHER_PLAN_PRICE_PRO_NGN ?? 5000 : process.env.TEACHER_PLAN_PRICE_PRO_USD ?? 50)
        : Number(currency === "NGN" ? process.env.TEACHER_PLAN_PRICE_BASIC_NGN ?? 2000 : process.env.TEACHER_PLAN_PRICE_BASIC_USD ?? 20);
    const expectedAmountMajorRaw = Number(metadata?.expected_amount_major ?? configuredAmountMajor);
    const expectedAmountMajor = Number.isFinite(expectedAmountMajorRaw) && expectedAmountMajorRaw > 0
      ? expectedAmountMajorRaw
      : configuredAmountMajor;
    const paidAmountMajor = Math.round(Number(data?.amount ?? 0)) / 100;

    if (!Number.isFinite(paidAmountMajor) || paidAmountMajor !== expectedAmountMajor) {
      return NextResponse.json({ received: true, warning: "Amount mismatch; skipped profile activation" }, { status: 200 });
    }

    const allowanceRaw =
      Number(metadata?.credits_allowance) ||
      Number(tier === "pro" ? process.env.TEACHER_PLAN_CREDITS_PRO ?? 50 : process.env.TEACHER_PLAN_CREDITS_BASIC ?? 20);
    const allowance = Number.isFinite(allowanceRaw) && allowanceRaw > 0 ? Math.trunc(allowanceRaw) : (tier === "pro" ? 50 : 20);

    const admin = createAdminClient();
    const profileRes = await admin
      .from("profiles")
      .select("id, paystack_subscription_code")
      .eq("id", userId)
      .maybeSingle();

    if (profileRes.error) {
      return NextResponse.json({ error: profileRes.error.message }, { status: 500 });
    }

    const existingReference = String(profileRes.data?.paystack_subscription_code ?? "");
    if (existingReference && existingReference === reference) {
      return NextResponse.json({ received: true, idempotent: true }, { status: 200 });
    }

    const email = data?.customer?.email ?? null;
    const customerCode = data?.customer?.customer_code ?? null;

    const updateRes = await admin
      .from("profiles")
      .update({
        plan: tier,
        is_pro: tier === "pro",
        credits_monthly_allowance: allowance,
        credits_balance: allowance,
        paystack_email: email,
        paystack_subscription_code: reference,
        paystack_customer_code: customerCode,
        updated_at: new Date().toISOString(),
      })
      .eq("id", userId);

    if (updateRes.error) {
      return NextResponse.json({ error: updateRes.error.message }, { status: 500 });
    }

    return NextResponse.json({ received: true }, { status: 200 });
  } catch (error) {
    console.error("Webhook error:", error);
    return NextResponse.json({ error: "Webhook processing failed" }, { status: 500 });
  }
}
