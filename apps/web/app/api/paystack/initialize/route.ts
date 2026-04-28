import { NextResponse } from "next/server";
import { paystackHeaders, appUrl } from "@/lib/paystack";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@supabase/supabase-js";
import {
  isValidTeacherPlanId,
  getPlanPaystackAmount,
  getPlanCredits,
} from "@/lib/billing/server-pricing";

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

    const { currency = "NGN", plan } = (await req.json()) as {
      currency?: "NGN" | "USD";
      plan: unknown;
    };

 if (!isValidTeacherPlanId(plan)) {
      return NextResponse.json({ error: "Invalid plan" }, { status: 400 });
    }

    // Get pricing and credits from centralized config
    const amountMinor = getPlanPaystackAmount(plan, currency);
    const creditsAllowance = getPlanCredits(plan);

 if (!Number.isFinite(amountMinor) || amountMinor <= 0) {
      return NextResponse.json({ error: "Invalid pricing for selected plan" }, { status: 500 });
    }
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
        callback_url: appUrl("/payment/success"),
        metadata: {
          purpose: "teacher_plan_purchase",
          user_id: user.id,
          plan,
          currency,
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

    // Convert minor units back to major for response
    const amountMajor = currency === "NGN" ? amountMinor / 100 : amountMinor / 100;

    return NextResponse.json({
      authorization_url: json.data.authorization_url,
      reference: json.data.reference,
      amount: amountMajor,
      currency,
      plan,
    });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
