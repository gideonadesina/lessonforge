import { NextResponse } from "next/server";
import crypto from "crypto";
import { paystackHeaders } from "@/lib/paystack";
import { createClient } from "@supabase/supabase-js";
import {
  getSchoolPlanSharedCredits,
  isValidSchoolPlanId,
  type SchoolPlanId,
} from "@/lib/billing/server-school-pricing";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendEmail } from "@/lib/emails/send";
import { schoolWorkspaceEmail } from "@/lib/emails/templates";

function normalizeSchoolPlanId(rawPlan: unknown): SchoolPlanId | null {
  if (!isValidSchoolPlanId(rawPlan)) return null;
  return rawPlan as SchoolPlanId;
}

function normalizeMetadataSchoolPlan(
  metadata: Record<string, unknown>
): SchoolPlanId | null {
  const directPlan = normalizeSchoolPlanId(metadata?.plan_id ?? metadata?.plan);
  if (directPlan) return directPlan;

  const planName = String(metadata?.plan_name ?? "").trim().toLowerCase();
  return normalizeSchoolPlanId(planName ? `school_${planName}` : null);
}

async function getActiveSchoolCode(schoolId: string): Promise<string | null> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("school_codes")
    .select("code")
    .eq("school_id", schoolId)
    .eq("is_active", true)
    .maybeSingle();

  return data?.code ? String(data.code) : null;
}

function isUniqueViolation(error: unknown) {
  const err = error as { code?: string; message?: string } | null;
  return (
    String(err?.code ?? "") === "23505" ||
    String(err?.message ?? "").toLowerCase().includes("duplicate key")
  );
}

function generateSchoolLicenseCode() {
  const letters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  let prefix = "";
  for (let i = 0; i < 4; i += 1) {
    prefix += letters[crypto.randomInt(0, letters.length)];
  }

  return `${prefix}-${crypto.randomInt(0, 10000).toString().padStart(4, "0")}`;
}

function getPlanName(metadata: Record<string, unknown>, planId: SchoolPlanId) {
  const explicit = String(metadata?.plan_name ?? "").trim();
  if (explicit) return explicit;

  const rawPlan = String(metadata?.plan ?? metadata?.plan_id ?? planId).trim();
  return rawPlan.startsWith("school_") ? rawPlan.slice("school_".length) : rawPlan;
}

function getProfilePlanForSchoolPlan(planName: string) {
  const normalizedPlan = planName.trim().toLowerCase().replace(/^school_/, "");

  switch (normalizedPlan) {
    case "starter":
      return "basic";
    case "growth":
      return "pro";
    case "professional":
      return "pro_plus";
    case "enterprise":
      return "ultra_pro";
    default:
      return "pro";
  }
}

function getCredits(metadata: Record<string, unknown>, planId: SchoolPlanId) {
  const rawCredits =
    metadata?.credits ?? metadata?.shared_credits_allowance ?? metadata?.shared_credits;
  const credits = Number(rawCredits);
  return Number.isFinite(credits) && credits >= 0
    ? credits
    : getSchoolPlanSharedCredits(planId);
}

function getFirstName(value: unknown, fallback = "there") {
  const name = String(value ?? "").trim();
  if (!name) return fallback;
  return name.split(/\s+/)[0] || fallback;
}

async function generateUniqueSchoolCode(
  admin: ReturnType<typeof createAdminClient>
) {
  for (let attempt = 0; attempt < 20; attempt += 1) {
    const code = generateSchoolLicenseCode();
    const [{ data: schoolCode }, { data: school }] = await Promise.all([
      admin.from("school_codes").select("code").eq("code", code).maybeSingle(),
      admin
        .from("schools")
        .select("id")
        .or(`code.eq.${code},license_code.eq.${code}`)
        .maybeSingle(),
    ]);

    if (!schoolCode?.code && !school?.id) return code;
  }

  throw new Error("Failed to generate a unique school code");
}

async function createOrResolveSchoolWorkspace(input: {
  principalId: string;
  planName: string;
  profilePlan: string;
  credits: number;
  schoolName?: string | null;
}) {
  const admin = createAdminClient();

  const { data: profile, error: profileError } = await admin
    .from("profiles")
    .select("full_name, email, school_id")
    .eq("id", input.principalId)
    .maybeSingle();

  if (profileError) {
    throw new Error(`Failed to load principal profile: ${profileError.message}`);
  }

  const existingSchoolId = String(profile?.school_id ?? "").trim();
  if (existingSchoolId) {
    const existingCode = await getActiveSchoolCode(existingSchoolId);
    if (existingCode) {
      const { error: profileUpdateError } = await admin
        .from("profiles")
        .update({ app_role: "principal", plan: input.profilePlan })
        .eq("id", input.principalId);

      if (profileUpdateError) {
        throw new Error(`Failed to update principal profile: ${profileUpdateError.message}`);
      }

      return {
        schoolId: existingSchoolId,
        schoolCode: existingCode,
        schoolName: null,
        principalEmail: String(profile?.email ?? "").trim() || null,
        principalName: String(profile?.full_name ?? "").trim() || null,
        created: false,
      };
    }
  }

  const principalName = String(profile?.full_name ?? "").trim();
  const schoolName = String(input.schoolName ?? "").trim() || "Your School";
  const now = new Date();
  const expiresAt = new Date(now);
  expiresAt.setFullYear(expiresAt.getFullYear() + 1);

  let lastError: unknown = null;
  for (let attempt = 0; attempt < 10; attempt += 1) {
    const schoolId = crypto.randomUUID();
    const code = await generateUniqueSchoolCode(admin);
    const timestamp = now.toISOString();

    const { error: schoolError } = await admin.from("schools").insert({
      id: schoolId,
      name: schoolName,
      license_code: code,
      max_seats: 999999,
      used_seats: 0,
      is_active: true,
      plan: input.planName,
      created_at: timestamp,
      code,
      updated_at: timestamp,
      shared_credits: input.credits,
      credits_used: 0,
      plan_type: input.planName,
      subscription_active: true,
      created_by: input.principalId,
      expires_at: expiresAt.toISOString(),
    });

    if (schoolError) {
      lastError = schoolError;
      if (isUniqueViolation(schoolError)) continue;
      throw new Error(`Failed to create school: ${schoolError.message}`);
    }

    const { error: profileUpdateError } = await admin
      .from("profiles")
      .update({
        school_id: schoolId,
        app_role: "principal",
        plan: input.profilePlan,
      })
      .eq("id", input.principalId);

    if (profileUpdateError) {
      throw new Error(`Failed to update principal profile: ${profileUpdateError.message}`);
    }

    const { error: codeError } = await admin.from("school_codes").insert({
      school_id: schoolId,
      code,
    });

    if (codeError) {
      if (isUniqueViolation(codeError)) {
        lastError = codeError;
        continue;
      }
      throw new Error(`Failed to create school code: ${codeError.message}`);
    }

    return {
      schoolId,
      schoolCode: code,
      schoolName,
      principalEmail: String(profile?.email ?? "").trim() || null,
      principalName: principalName || null,
      created: true,
    };
  }

  const message = lastError instanceof Error ? lastError.message : "unknown error";
  throw new Error(`Failed to create school workspace: ${message}`);
}

export async function GET(req: Request) {
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
        auth: {
          persistSession: false,
          autoRefreshToken: false,
          detectSessionInUrl: false,
        },
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

    const { searchParams } = new URL(req.url);
    const reference = String(searchParams.get("reference") ?? "").trim();

    if (!reference) {
      return NextResponse.json({ error: "Missing reference" }, { status: 400 });
    }

    // Verify with Paystack
    const res = await fetch(
      `https://api.paystack.co/transaction/verify/${encodeURIComponent(reference)}`,
      {
        headers: paystackHeaders(),
      }
    );

    const json = await res.json();

    if (!res.ok || !json?.status) {
      return NextResponse.json(
        { error: "Verify failed", details: json },
        { status: 400 }
      );
    }

    if (json?.data?.status !== "success") {
      return NextResponse.json(
        { error: "Payment was not successful" },
        { status: 400 }
      );
    }

    const paystackData = json.data ?? {};
    const metadata = (paystackData?.metadata ?? {}) as Record<string, unknown>;
    const userId = String(
      metadata?.principal_id ?? metadata?.user_id ?? ""
    ).trim();
    const planId = normalizeMetadataSchoolPlan(metadata);

    if (!userId || !planId) {
      return NextResponse.json(
        {
          error:
            "Missing required payment metadata (user_id or plan)",
        },
        { status: 400 }
      );
    }

    if (user.id !== userId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const planName = getPlanName(metadata, planId);
    const profilePlan = getProfilePlanForSchoolPlan(planName);
    const credits = getCredits(metadata, planId);
    const {
      schoolCode,
      schoolName,
      principalEmail,
      principalName,
      created,
    } = await createOrResolveSchoolWorkspace({
      principalId: userId,
      planName,
      profilePlan,
      credits,
      schoolName: String(metadata?.school_name ?? "").trim() || null,
    });

    if (created) {
      const to =
        principalEmail ||
        String(paystackData?.customer?.email ?? "").trim() ||
        user.email ||
        null;

      if (to) {
        await sendEmail({
          to,
          subject: "Your school workspace is ready",
          html: schoolWorkspaceEmail({
            firstName: getFirstName(principalName, "there"),
            schoolName,
            schoolCode,
            planName,
            schoolCredits: credits,
          }),
        });
      }
    }

    // Return success
    return NextResponse.json({
      ok: true,
      success: true,
      type: "school_plan",
      school_code: schoolCode,
      schoolCode,
      plan: planName,
      credits,
      redirectTo: "/principal/dashboard?success=true",
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "School payment verify failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
