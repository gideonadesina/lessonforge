import { NextResponse } from "next/server";
import { paystackHeaders, appUrl } from "../../lib/paystack";
import { createAdminClient } from "../../../lib/supabase/admin";

export async function POST(req: Request) {
  try {
    const { user_id, email, currency } = (await req.json()) as {
      user_id: string;
      email: string;
      currency: "NGN" | "USD";
    };

    if (!user_id || !email) {
      return NextResponse.json({ error: "Missing user_id or email" }, { status: 400 });
    }

    const plan =
      currency === "USD"
        ? process.env.PAYSTACK_PLAN_CODE_USD
        : process.env.PAYSTACK_PLAN_CODE_NGN;

    if (!plan) {
      return NextResponse.json({ error: "Missing PAYSTACK_PLAN_CODE" }, { status: 500 });
    }

    // ensure profile exists
    const admin = createAdminClient();
    await admin.from("profiles").upsert(
      {
        id: user_id,
        paystack_email: email,
        plan: currency,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "id" }
    );

    // Initialize transaction with plan => Paystack creates subscription after first payment
    const res = await fetch("https://api.paystack.co/transaction/initialize", {
      method: "POST",
      headers: paystackHeaders(),
      body: JSON.stringify({
        email,
        plan,
        currency,
        callback_url: appUrl("/billing/success"),
        metadata: {
          user_id,
          plan_currency: currency,
        },
      }),
    });

    const json = await res.json();

    if (!res.ok || !json?.status) {
      return NextResponse.json({ error: "Paystack init failed", details: json }, { status: 400 });
    }

    return NextResponse.json({
      authorization_url: json.data.authorization_url,
      reference: json.data.reference,
    });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? String(e) }, { status: 500 });
  }
}
