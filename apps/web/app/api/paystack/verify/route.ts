import { NextResponse } from "next/server";
import { paystackHeaders } from "@/lib/paystack";
import { createAdminClient } from "@/lib/supabase/admin";

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
    const currency = (json?.data?.currency as "NGN" | "USD") || "NGN";
    const subscription_code = json?.data?.subscription?.subscription_code as string | undefined;
    const customer_code = json?.data?.customer?.customer_code as string | undefined;

    if (user_id) {
      const admin = createAdminClient();
      await admin.from("profiles").upsert(
        {
          id: user_id,
          is_pro: true,
          free_credits: 1, // optional (or leave credits as-is)
          pro_expires_at: new Date(Date.now() + 32 * 24 * 60 * 60 * 1000).toISOString(),
          plan: currency,
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
