import { NextRequest, NextResponse } from "next/server";
import { paystackHeaders, appUrl } from "@/lib/paystack";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@supabase/supabase-js";
import {
  isValidSchoolPlanId,
  getSchoolPlanPaystackAmount,
  getSchoolPlanSharedCredits,
  getSchoolPlanTeacherLimit,
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
    } = (await req.json()) as {
      plan: unknown;
      callbackPath?: unknown;
      schoolName?: unknown;
    };

    if (!isValidSchoolPlanId(plan)) {
      return NextResponse.json({ error: "Invalid school plan" }, { status: 400 });
    }

    const amountMinor = getSchoolPlanPaystackAmount(plan, "NGN");
    const sharedCredits = getSchoolPlanSharedCredits(plan);
    const teacherLimit = getSchoolPlanTeacherLimit(plan);

    if (!Number.isFinite(amountMinor) || amountMinor <= 0) {
      return NextResponse.json(
        { error: "Invalid pricing for selected plan" },
        { status: 500 }
      );
    }

    const admin = createAdminClient();

    // Get or create school for this principal
    let schoolId: string | null = null;
    const { data: membership } = await admin
      .from("school_members")
      .select("school_id")
      .eq("user_id", user.id)
      .eq("role", "principal")
      .maybeSingle();

    if (membership?.school_id) {
      schoolId = membership.school_id;
    } else {
      // Create a new school for this principal
      const normalizedSchoolName = String(schoolName ?? "").trim();
      const { data: newSchool, error: schoolError } = await admin
        .from("schools")
        .insert({
          name: normalizedSchoolName || `School - ${user.email}`,
          principal_id: user.id,
          shared_credits: 0,
          teacher_limit: 0,
        })
        .select("id")
        .maybeSingle();

      if (schoolError || !newSchool?.id) {
        return NextResponse.json(
          { error: "Failed to create school workspace" },
          { status: 500 }
        );
      }

      schoolId = newSchool.id;

      // Add principal as member
      await admin.from("school_members").insert({
        school_id: schoolId,
        user_id: user.id,
        role: "principal",
      });
    }

    await admin.from("profiles").upsert(
      {
        id: user.id,
        paystack_email: user.email,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "id" }
    );

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
          payment_purpose: "school",
          user_id: user.id,
          school_id: schoolId,
          plan_id: plan,
          currency: "NGN",
          expected_amount_minor: amountMinor,
          shared_credits_allowance: sharedCredits,
          teacher_limit_allowance: teacherLimit,
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
