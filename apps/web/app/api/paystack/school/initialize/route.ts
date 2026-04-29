import { NextRequest, NextResponse } from "next/server";
import { paystackHeaders, appUrl } from "@/lib/paystack";
import { createClient } from "@supabase/supabase-js";
import {
  isValidSchoolPlanId,
  getSchoolPlanPaystackAmount,
  getSchoolPlanSharedCredits,
} from "@/lib/billing/server-school-pricing";

export async function POST(req: NextRequest) {
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

    const { data: { user }, error: authError } = await userClient.auth.getUser();
    if (authError || !user?.id || !user.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const {
      plan,
      callbackPath,
      schoolName,
      principalName,
    } = (await req.json()) as {
      plan: unknown;
      callbackPath?: unknown;
      schoolName?: unknown;
      principalName?: unknown;
    };

    if (!isValidSchoolPlanId(plan)) {
      return NextResponse.json({ error: "Invalid school plan" }, { status: 400 });
    }

    const amountMinor = getSchoolPlanPaystackAmount(plan, "NGN");
    const sharedCredits = getSchoolPlanSharedCredits(plan);

    if (!Number.isFinite(amountMinor) || amountMinor <= 0) {
      return NextResponse.json(
        { error: "Invalid pricing for selected plan" },
        { status: 500 }
      );
    }

    const normalizedCallbackPath =
      typeof callbackPath === "string" && callbackPath.startsWith("/")
        ? callbackPath
        : "/principal/pricing?paymentComplete=true";

    const res = await fetch("https://api.paystack.co/transaction/initialize", {
      method: "POST",
      headers: paystackHeaders(),
      body: JSON.stringify({
        email: user.email,
        amount: amountMinor,
        currency: "NGN",
        callback_url: appUrl(normalizedCallbackPath),
        metadata: {
          type: "school_plan",
          payment_purpose: "school",
          principal_id: user.id,
          user_id: user.id,
          school_name: String(schoolName ?? "").trim(),
          principal_name: String(principalName ?? "").trim(),
          plan,
          plan_id: plan,
          currency: "NGN",
          expected_amount_minor: amountMinor,
          shared_credits_allowance: sharedCredits,
          initiated_at: new Date().toISOString(),
        },
      }),
    });

    const json = await res.json();

    if (!res.ok || !json?.status) {
      return NextResponse.json(
        { error: "Paystack init failed", details: json },
        { status: 400 }
      );
    }

    return NextResponse.json({
      ok: true,
      authorization_url: json.data.authorization_url,
      access_code: json.data.access_code,
      reference: json.data.reference,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "School payment init failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
