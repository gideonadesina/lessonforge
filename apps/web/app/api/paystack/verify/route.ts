import { NextResponse } from "next/server";
import { paystackHeaders } from "@/lib/paystack";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@supabase/supabase-js";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const reference = searchParams.get("reference");

  if (!reference) {
    return NextResponse.json({ error: "Missing reference" }, { status: 400 });
  }

  const auth = req.headers.get("authorization") ?? "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
  if (!token) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userClient = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
      global: { headers: { Authorization: `Bearer ${token}` } },
    }
  );
  const {
    data: { user },
    error: authError,
  } = await userClient.auth.getUser();
  if (authError || !user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const res = await fetch(`https://api.paystack.co/transaction/verify/${reference}`, {
    headers: paystackHeaders(),
  });
  const json = await res.json();

  if (!res.ok || !json?.status) {
    return NextResponse.json({ error: "Verify failed", details: json }, { status: 400 });
  }

  if (json?.data?.status !== "success") {
    return NextResponse.json({ error: "Payment not successful yet." }, { status: 400 });
  }

  const metadata = (json?.data?.metadata ?? {}) as Record<string, unknown>;
  const purpose = String(metadata?.purpose ?? "");
  if (purpose !== "teacher_plan_purchase") {
    return NextResponse.json({ error: "This payment reference is not a teacher plan payment." }, { status: 400 });
  }

  const ownerId = String(metadata?.user_id ?? "");
  if (!ownerId || ownerId !== user.id) {
    return NextResponse.json({ error: "Payment ownership mismatch." }, { status: 403 });
  }

  const tier = String(metadata?.tier ?? "").toLowerCase() === "pro" ? "pro" : "basic";
  const currency = (String(json?.data?.currency ?? "NGN").toUpperCase() === "USD" ? "USD" : "NGN") as "NGN" | "USD";
  const configuredAmountMajor =
    tier === "pro"
      ? Number(currency === "NGN" ? process.env.TEACHER_PLAN_PRICE_PRO_NGN ?? 5000 : process.env.TEACHER_PLAN_PRICE_PRO_USD ?? 50)
      : Number(currency === "NGN" ? process.env.TEACHER_PLAN_PRICE_BASIC_NGN ?? 2000 : process.env.TEACHER_PLAN_PRICE_BASIC_USD ?? 20);
  const expectedAmountMajorRaw = Number(metadata?.expected_amount_major ?? configuredAmountMajor);
  const expectedAmountMajor = Number.isFinite(expectedAmountMajorRaw) && expectedAmountMajorRaw > 0
    ? expectedAmountMajorRaw
    : configuredAmountMajor;
  const paidAmountMajor = Math.round(Number(json?.data?.amount ?? 0)) / 100;

  if (!Number.isFinite(paidAmountMajor) || paidAmountMajor !== expectedAmountMajor) {
    return NextResponse.json(
      {
        error: "Amount mismatch",
        expected: expectedAmountMajor,
        paid: paidAmountMajor,
      },
      { status: 400 }
    );
  }

  const allowanceRaw =
    Number(metadata?.credits_allowance) ||
    Number(tier === "pro" ? process.env.TEACHER_PLAN_CREDITS_PRO ?? 50 : process.env.TEACHER_PLAN_CREDITS_BASIC ?? 20);
  const allowance = Number.isFinite(allowanceRaw) && allowanceRaw > 0 ? Math.trunc(allowanceRaw) : (tier === "pro" ? 50 : 20);

  const admin = createAdminClient();
  const profileRes = await admin
    .from("profiles")
    .select("id, paystack_subscription_code")
    .eq("id", user.id)
    .maybeSingle();

  if (profileRes.error) {
    return NextResponse.json({ error: profileRes.error.message }, { status: 500 });
  }

  const existingReference = String(profileRes.data?.paystack_subscription_code ?? "");
  if (existingReference && existingReference === reference) {
    return NextResponse.json({ ok: true, idempotent: true, data: json.data });
  }

  const customerCode = json?.data?.customer?.customer_code as string | undefined;
  const email = json?.data?.customer?.email as string | undefined;

  const updateRes = await admin.from("profiles").upsert(
    {
      id: user.id,
      plan: tier,
      is_pro: tier === "pro",
      credits_monthly_allowance: allowance,
      credits_balance: allowance,
      paystack_email: email ?? user.email ?? null,
      paystack_customer_code: customerCode ?? null,
      // Re-using existing column as idempotency ledger for manual one-off payments.
      paystack_subscription_code: reference,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "id" }
  );

  if (updateRes.error) {
    return NextResponse.json({ error: updateRes.error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, idempotent: false, data: json.data });
}
