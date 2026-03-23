import { NextResponse } from "next/server";
import { paystackHeaders, appUrl } from "@/lib/paystack";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@supabase/supabase-js";

export async function POST(req: Request) {
  try {
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

    if (authError || !user?.id || !user.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { currency = "NGN", tier } = (await req.json()) as {
      currency?: "NGN" | "USD";
      tier: "basic" | "pro";
    };

 if (tier !== "basic" && tier !== "pro") {
      return NextResponse.json({ error: "Invalid tier" }, { status: 400 });
    }
  const isNGN = currency === "NGN";
    const amountMajor =
      tier === "pro"
        ? Number(isNGN ? process.env.TEACHER_PLAN_PRICE_PRO_NGN ?? 5000 : process.env.TEACHER_PLAN_PRICE_PRO_USD ?? 50)
        : Number(isNGN ? process.env.TEACHER_PLAN_PRICE_BASIC_NGN ?? 2000 : process.env.TEACHER_PLAN_PRICE_BASIC_USD ?? 20);
    const creditsAllowance =
      tier === "pro"
        ? Number(process.env.TEACHER_PLAN_CREDITS_PRO ?? 50)
        : Number(process.env.TEACHER_PLAN_CREDITS_BASIC ?? 20);
if (!Number.isFinite(amountMajor) || amountMajor <= 0) {
      return NextResponse.json({ error: "Invalid configured amount for selected tier" }, { status: 500 });
    }

    const amountMinor = Math.round(amountMajor * 100);
    const admin = createAdminClient();
    await admin.from("profiles").upsert(
      {
        id: user.id,
        paystack_email: user.email,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "id" }
    );
      const res = await fetch("https://api.paystack.co/transaction/initialize", {
      method: "POST",
      headers: paystackHeaders(),
      body: JSON.stringify({
        email: user.email,
        amount: amountMinor,
        currency,
        callback_url: appUrl("/billing/success"),
        metadata: {
          purpose: "teacher_plan_purchase",
          user_id: user.id,
          tier,
          currency,
          expected_amount_major: amountMajor,
          expected_amount_minor: amountMinor,
          credits_allowance: creditsAllowance,
          initiated_at: new Date().toISOString(),
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
      amount: amountMajor,
      currency,
      tier,
    });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
