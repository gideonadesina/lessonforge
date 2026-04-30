import { NextResponse } from "next/server";
import crypto from "crypto";
import { paystackHeaders } from "@/lib/paystack";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  getPlanPricing,
  isValidTeacherPlanId,
  type TeacherPlanId,
} from "@/lib/billing/server-pricing";
import {
  getSchoolPlanSharedCredits,
  isValidSchoolPlanId,
  type SchoolPlanId,
} from "@/lib/billing/server-school-pricing";
import {
  processTeacherPayment,
  type ProcessPaymentInput,
} from "@/lib/billing/server-payment";
import { sendEmail } from "@/lib/emails/send";
import {
  paymentConfirmedEmail,
  schoolWorkspaceEmail,
} from "@/lib/emails/templates";

function normalizeTeacherPlanId(rawPlan: unknown): TeacherPlanId | null {
  if (!isValidTeacherPlanId(rawPlan)) return null;
  return rawPlan as TeacherPlanId;
}

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

function formatPaidAmount(amountMinor: unknown, currency: unknown) {
  const normalizedCurrency = String(currency ?? "NGN").toUpperCase();
  const numericAmount = Number(amountMinor ?? 0);
  if (!Number.isFinite(numericAmount)) return 0;
  return normalizedCurrency === "NGN" ? numericAmount / 100 : numericAmount / 100;
}

function getFirstName(value: unknown, fallback = "there") {
  const name = String(value ?? "").trim();
  if (!name) return fallback;
  return name.split(/\s+/)[0] || fallback;
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
      await admin
        .from("profiles")
        .update({ app_role: "principal", plan: input.profilePlan })
        .eq("id", input.principalId);

      return {
        schoolId: existingSchoolId,
        schoolCode: existingCode,
        created: false,
        principalEmail: String(profile?.email ?? "").trim() || null,
        principalName: String(profile?.full_name ?? "").trim() || null,
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
      code,
      max_seats: 999999,
      used_seats: 0,
      is_active: true,
      plan: input.planName,
      created_at: timestamp,
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
      created: true,
      principalEmail: String(profile?.email ?? "").trim() || null,
      principalName: principalName || null,
    };
  }

  const message = lastError instanceof Error ? lastError.message : "unknown error";
  throw new Error(`Failed to create school workspace: ${message}`);
}

async function resolvePlanForUser(userId: string, data: any): Promise<TeacherPlanId> {
  const admin = createAdminClient();

  const { data: existing } = await admin
    .from("profiles")
    .select("plan")
    .eq("id", userId)
    .maybeSingle();

  // Try to get plan from metadata first
  const fromMetadata = normalizeTeacherPlanId(data?.metadata?.plan);
  if (fromMetadata) return fromMetadata;

  // Fall back to existing plan in database
  const fromExisting = normalizeTeacherPlanId(existing?.plan);
  if (fromExisting) return fromExisting;

  // Default to basic if unable to determine
  return "basic";
}

/**
 * Update profile metadata and plan info after payment.
 * Separate from credit grant to avoid overwriting balance.
 */
async function updateProfileMetadata(
  userId: string,
  plan: TeacherPlanId,
  paystackData: any
) {
  const admin = createAdminClient();

  await admin
    .from("profiles")
    .update({
      plan,
      is_pro: plan !== "basic",
      pro_expires_at: null,
      paystack_subscription_code:
        paystackData?.subscription?.subscription_code ?? null,
      paystack_customer_code: paystackData?.customer?.customer_code ?? null,
      paystack_email: paystackData?.customer?.email ?? null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", userId);
}

export async function GET(req: Request) {
  try {
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
    const metadataType = String(metadata?.type ?? "").trim();
    const paymentPurpose = String(metadata?.payment_purpose ?? "").trim();

    if (metadataType === "school_plan" || paymentPurpose === "school") {
      const principalId = String(
        metadata?.principal_id ?? metadata?.user_id ?? ""
      ).trim();
      const planId = normalizeMetadataSchoolPlan(metadata);

      if (!principalId || !planId) {
        return NextResponse.json(
          { error: "Missing required school payment metadata" },
          { status: 400 }
        );
      }

      const planName = getPlanName(metadata, planId);
      const profilePlan = getProfilePlanForSchoolPlan(planName);
      const credits = getCredits(metadata, planId);
      const {
        schoolId,
        schoolCode,
        created,
        principalEmail,
        principalName,
      } = await createOrResolveSchoolWorkspace({
        principalId,
        planName,
        profilePlan,
        credits,
        schoolName: String(metadata?.school_name ?? "").trim() || null,
      });

      if (created) {
        const to =
          principalEmail ||
          String(paystackData?.customer?.email ?? "").trim() ||
          null;

        if (to) {
          await sendEmail({
            to,
            subject: "Your school workspace is ready",
            html: schoolWorkspaceEmail({
              firstName: getFirstName(principalName, "there"),
              schoolName: null,
              schoolCode,
              planName,
              schoolCredits: credits,
            }),
          });
        }
      }

      return NextResponse.json({
        ok: true,
        type: "school_plan",
        reference,
        userId: principalId,
        schoolId,
        plan: planName,
        amountPaid: formatPaidAmount(paystackData?.amount, paystackData?.currency),
        currency: String(paystackData?.currency ?? "NGN").toUpperCase(),
        sharedCreditsAwarded: credits,
        previousBalance: 0,
        newBalance: credits,
        schoolCode,
        alreadyProcessed: false,
        redirectTo: "/principal/dashboard",
      });
    }

    const userId = String(paystackData?.metadata?.user_id ?? "").trim();

    if (!userId) {
      return NextResponse.json(
        { error: "Missing user_id in payment metadata" },
        { status: 400 }
      );
    }

    // Resolve the plan
    const plan = await resolvePlanForUser(userId, paystackData);

    // Process payment with idempotency
    const paymentResult = await processTeacherPayment({
      reference,
      userId,
      plan,
      amount: paystackData?.amount,
      currency: paystackData?.currency,
      paystackCustomerCode: paystackData?.customer?.customer_code,
      paystackSubscriptionCode: paystackData?.subscription?.subscription_code,
      paystackEmail: paystackData?.customer?.email,
      payerPayload: paystackData,
      flow: "teacher_checkout",
    } as ProcessPaymentInput);

    if (!paymentResult.ok) {
      return NextResponse.json(
        { error: paymentResult.error },
        { status: 500 }
      );
    }

    // Update profile metadata (plan, expiry, paystack codes)
    await updateProfileMetadata(userId, plan, paystackData);

    if (!paymentResult.alreadyProcessed) {
      const admin = createAdminClient();
      const { data: profile } = await admin
        .from("profiles")
        .select("email, full_name")
        .eq("id", userId)
        .maybeSingle();
      const to =
        String(profile?.email ?? "").trim() ||
        String(paystackData?.customer?.email ?? "").trim();

      if (to) {
        await sendEmail({
          to,
          subject: "Payment confirmed — your credits are ready",
          html: paymentConfirmedEmail({
            firstName: getFirstName(profile?.full_name),
            planName: getPlanPricing(plan)?.name ?? plan,
            creditsAdded: paymentResult.creditsAwarded,
            amountPaid: `₦${formatPaidAmount(
              paystackData?.amount,
              paystackData?.currency
            )}`,
            newBalance: paymentResult.newBalance,
            paymentReference: reference,
            paidAt: paystackData?.paid_at ?? paystackData?.created_at ?? new Date().toISOString(),
          }),
        });
      }
    }

    // Return success with credit info
    return NextResponse.json({
      ok: true,
      type: "teacher_plan",
      reference,
      userId,
      plan,
      creditsAwarded: paymentResult.creditsAwarded,
      previousBalance: paymentResult.previousBalance,
      newBalance: paymentResult.newBalance,
      alreadyProcessed: paymentResult.alreadyProcessed,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Verification failed";
    console.error("Paystack verify error:", error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
