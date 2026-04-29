import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  getBearerTokenFromHeaders,
  resolvePrincipalContext,
} from "@/lib/principal/server";
import { paystackHeaders } from "@/lib/paystack";
import { verifyPaystackTransaction } from "@/lib/paystack";
import {
  DEFAULT_CURRENCY,
  generateLicenseCode,
  generateSchoolCode,
  isMissingTableOrColumnError,
} from "@/lib/principal/utils";
import { getSchoolPlanPricing } from "@/lib/billing/server-school-pricing";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

type OnboardingPayload = {
  principalName?: string;
  schoolName?: string;
  payment?: {
    provider?: "paystack";
    reference?: string | null;
  };
};

type SchoolInsertRecord = {
  id: string;
  name: string | null;
  code: string | null;
  created_at: string | null;
  created_by: string | null;
  principal_name?: string | null;
};
type PaystackVerifyData = {
  status: string;
  amount: number;
  currency: string;
  reference: string;
  paid_at?: string | null;
  metadata?: Record<string, unknown> | null;
};

function isUniqueViolation(error: unknown) {
  const err = error as { code?: string; message?: string } | null;
  return (
    String(err?.code ?? "") === "23505" ||
    String(err?.message ?? "").toLowerCase().includes("duplicate key")
  );
}

function getErrorStatus(message: string) {
  const m = message.toLowerCase();
  if (m.includes("unauthorized")) return 401;
  if (m.includes("forbidden") || m.includes("does not belong")) return 403;
  if (
    m.includes("required") ||
    m.includes("missing") ||
    m.includes("invalid") ||
    m.includes("not successful") ||
    m.includes("mismatch")
  ) {
    return 400;
  }
  return 500;
}

async function insertSchool(
  admin: ReturnType<typeof createAdminClient>,
  input: {
    schoolName: string;
    principalName: string;
    userId: string;
    code: string;
    licenseCode: string;
  }
): Promise<SchoolInsertRecord> {
  const withPrincipalRes = await admin
    .from("schools")
    .insert({
      name: input.schoolName,
      created_by: input.userId,
      code: input.code,
      license_code: input.licenseCode,
      principal_name: input.principalName,
    })
    .select("id, name, code, created_at, created_by, principal_name")
    .single();

  if (!withPrincipalRes.error) {
    return withPrincipalRes.data as SchoolInsertRecord;
  }

  if (!isMissingTableOrColumnError(withPrincipalRes.error)) {
    throw withPrincipalRes.error;
  }

  const fallbackRes = await admin
    .from("schools")
    .insert({
      name: input.schoolName,
      created_by: input.userId,
      code: input.code,
      license_code: input.licenseCode,
    })
    .select("id, name, code, created_at, created_by")
    .single();

  if (fallbackRes.error) {
    throw fallbackRes.error;
  }

  return fallbackRes.data as SchoolInsertRecord;
}

function parsePositiveNumber(value: unknown) {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : null;
}

async function verifyPaystackReference(reference: string) {
  const verifyRes = await fetch(`https://api.paystack.co/transaction/verify/${encodeURIComponent(reference)}`, {
    headers: paystackHeaders(),
  });
  const verifyJson = await verifyRes.json();

  if (!verifyRes.ok || !verifyJson?.status) {
    throw new Error("Could not verify payment with Paystack.");
  }
  if (verifyJson?.data?.status !== "success") {
    throw new Error("Payment has not been completed successfully.");
  }

  return verifyJson.data as PaystackVerifyData;
}


async function insertSchoolWithRetry(
  admin: ReturnType<typeof createAdminClient>,
  input: {
    schoolName: string;
    principalName: string;
    userId: string;
  }
) {
  let schoolCode = generateSchoolCode(input.schoolName);
  let licenseCode = generateLicenseCode(input.schoolName);
  let lastError: unknown = null;

  for (let attempt = 0; attempt < 5; attempt += 1) {
    try {
      const school = await insertSchool(admin, {
        ...input,
        code: schoolCode,
        licenseCode,
      });
      return { school, schoolCode, licenseCode };
    } catch (error) {
      lastError = error;
      if (!isUniqueViolation(error) || attempt === 4) break;
      schoolCode = generateSchoolCode(input.schoolName);
      licenseCode = generateLicenseCode(input.schoolName);
    }
  }

  throw lastError ?? new Error("Failed to create school");
}

async function ensurePrincipalMembership(
  admin: ReturnType<typeof createAdminClient>,
  schoolId: string,
  userId: string
) {
  let memberRes = await admin.from("school_members").insert({
    school_id: schoolId,
    user_id: userId,
    role: "principal",
    status: "active",
  });

  if (memberRes.error && isMissingTableOrColumnError(memberRes.error)) {
    memberRes = await admin.from("school_members").insert({
      school_id: schoolId,
      user_id: userId,
      role: "principal",
    });
  }

  if (!memberRes.error) return;

  if (isUniqueViolation(memberRes.error)) {
    let promoteRes = await admin
      .from("school_members")
      .update({ role: "principal", status: "active" })
      .eq("school_id", schoolId)
      .eq("user_id", userId);

    if (promoteRes.error && isMissingTableOrColumnError(promoteRes.error)) {
      promoteRes = await admin
        .from("school_members")
        .update({ role: "principal" })
        .eq("school_id", schoolId)
        .eq("user_id", userId);
    }

    if (promoteRes.error && !isMissingTableOrColumnError(promoteRes.error)) {
      throw new Error(promoteRes.error.message);
    }

    return;
  }

  if (!isMissingTableOrColumnError(memberRes.error)) {
    throw new Error(memberRes.error.message);
  }
}

async function ensureSchoolCode(
  admin: ReturnType<typeof createAdminClient>,
  input: {
    schoolId: string;
    schoolName: string;
    userId: string;
    preferredCode?: string | null;
  }
) {
  let schoolCode = String(input.preferredCode ?? "").trim();

  const activeCodeRes = await admin
    .from("school_codes")
    .select("code")
    .eq("school_id", input.schoolId)
    .eq("is_active", true)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (activeCodeRes.error && !isMissingTableOrColumnError(activeCodeRes.error)) {
    throw new Error(activeCodeRes.error.message);
  }

  if (activeCodeRes.data?.code) {
    schoolCode = String(activeCodeRes.data.code).trim();
  }

  if (!schoolCode) {
    schoolCode = generateSchoolCode(input.schoolName);
  }

  if (!activeCodeRes.data?.code) {
    for (let attempt = 0; attempt < 5; attempt += 1) {
      let codeRes = await admin.from("school_codes").insert({
        school_id: input.schoolId,
        code: schoolCode,
        is_active: true,
        generated_by: input.userId,
      });

      if (codeRes.error && isMissingTableOrColumnError(codeRes.error)) {
        codeRes = await admin.from("school_codes").insert({
          school_id: input.schoolId,
          code: schoolCode,
        });
      }

      if (!codeRes.error || isMissingTableOrColumnError(codeRes.error)) {
        break;
      }

      if (isUniqueViolation(codeRes.error) && attempt < 4) {
        schoolCode = generateSchoolCode(input.schoolName);
        continue;
      }

      throw new Error(codeRes.error.message);
    }
  }

  const schoolUpdate = await admin
    .from("schools")
    .update({ code: schoolCode })
    .eq("id", input.schoolId);

  if (schoolUpdate.error && !isMissingTableOrColumnError(schoolUpdate.error)) {
    throw new Error(schoolUpdate.error.message);
  }

  return schoolCode;
}

async function ensureInitialSubscription(
  admin: ReturnType<typeof createAdminClient>,
  input: {
    schoolId: string;
    amount: number;
    provider: "placeholder" | "paystack";
    reference: string | null;
    forceCreate: boolean;
  }
) {
  if (input.reference) {
    const byReference = await admin
      .from("subscriptions")
      .select("id")
      .eq("reference", input.reference)
      .limit(1)
      .maybeSingle();

    if (byReference.error && !isMissingTableOrColumnError(byReference.error)) {
      throw new Error(byReference.error.message);
    }

    if (byReference.data?.id) {
      return;
    }
  }

  if (!input.forceCreate) {
    const existingSub = await admin
      .from("subscriptions")
      .select("id")
      .eq("school_id", input.schoolId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (existingSub.error && !isMissingTableOrColumnError(existingSub.error)) {
      throw new Error(existingSub.error.message);
    }

    if (existingSub.data?.id) {
      return;
    }
  }

  let subRes = await admin.from("subscriptions").insert({
    school_id: input.schoolId,
    amount: input.amount,
    currency: DEFAULT_CURRENCY,
    status: "paid",
    provider: input.provider,
    reference: input.reference,
    billing_cycle: "monthly",
    paid_at: new Date().toISOString(),
  });

  if (subRes.error && isMissingTableOrColumnError(subRes.error)) {
    subRes = await admin.from("subscriptions").insert({
      school_id: input.schoolId,
      amount: input.amount,
      currency: DEFAULT_CURRENCY,
      status: "paid",
      provider: input.provider,
      reference: input.reference,
      paid_at: new Date().toISOString(),
    });
  }

  if (subRes.error && !isMissingTableOrColumnError(subRes.error)) {
    throw new Error(subRes.error.message);
  }
}

async function assertPayment(
  input: {
    provider: "placeholder" | "paystack";
    paymentStatus: "success" | "pending" | "failed";
    reference: string | null;
    expectedAmount: number;
    userId: string;
  }
) {
  if (input.provider === "placeholder") {
    if (process.env.NODE_ENV === "production") {
      throw new Error("Placeholder payment is not allowed in production.");
    }
    if (input.paymentStatus !== "success") {
      throw new Error("Payment is not confirmed. Complete payment before onboarding.");
    }
    return;
  }

  if (!input.reference) {
    throw new Error("Payment reference is required.");
  }

  const paystackData = await verifyPaystackTransaction(input.reference);
  const paystackStatus = String(paystackData?.status ?? "").toLowerCase();
  if (paystackStatus !== "success") {
    throw new Error("Paystack payment is not successful.");
  }

  const paystackUserId = String(paystackData?.metadata?.user_id ?? "").trim();
  if (paystackUserId && paystackUserId !== input.userId) {
    throw new Error("Payment reference does not belong to this user.");
  }

  const paidAmount = Number(paystackData?.amount ?? 0) / 100;
  if (paidAmount !== input.expectedAmount) {
    throw new Error("Payment amount mismatch.");
  }
}

export async function POST(req: NextRequest) {
  try {
    const token = getBearerTokenFromHeaders(req.headers);
    const context = await resolvePrincipalContext(token);

    if (!context.ok || !context.user) {
      return NextResponse.json(
        { ok: false, error: context.error ?? "Unauthorized" },
        { status: context.status ?? 401 }
      );
    }

    if (context.isTeacherOnly) {
      return NextResponse.json(
        {
          ok: false,
          error: "Teacher accounts cannot create principal workspaces.",
        },
        { status: 403 }
      );
    }

    const body = (await req.json().catch(() => null)) as OnboardingPayload | null;

      const paymentReference = String(body?.payment?.reference ?? "").trim();
    if (!paymentReference) {
      return NextResponse.json({ ok: false, error: "Payment reference is required." }, { status: 400 });
    }

    const verified = await verifyPaystackReference(paymentReference);
    const metadata = (verified.metadata ?? {}) as Record<string, unknown>;
    const purpose = String(metadata?.purpose ?? "");
    if (purpose !== "principal_onboarding") {
      return NextResponse.json({ ok: false, error: "Payment purpose mismatch for principal onboarding." }, { status: 400 });
    }

    const ownerId = String(metadata?.user_id ?? "");
    if (!ownerId || ownerId !== context.user.id) {
      return NextResponse.json({ ok: false, error: "Payment ownership mismatch." }, { status: 403 });
    }

    const principalName = String(metadata?.principal_name ?? body?.principalName ?? "").trim();
    const schoolName = String(metadata?.school_name ?? body?.schoolName ?? context.school?.name ?? "").trim();

    const provider: "paystack" = "paystack";
    const reference = body?.payment?.reference ?? null;

    if (!principalName || !schoolName) {
      return NextResponse.json({ ok: false, error: "Principal name and school name are required." }, { status: 400 });
    }
     const expectedAmount = getSchoolPlanPricing("school_starter")?.priceNaira ?? 35000;
    const expectedAmountFromMeta = parsePositiveNumber(metadata?.expected_amount_major);
    const expectedMajorAmount = expectedAmountFromMeta ?? expectedAmount;
    const paidAmountMajor = Math.round(Number(verified.amount ?? 0)) / 100;
    if (!Number.isFinite(paidAmountMajor) || paidAmountMajor !== expectedMajorAmount) {
      return NextResponse.json({ ok: false, error: "Payment amount mismatch." }, { status: 400 });
    }

   
    const amount = expectedAmount;

    await assertPayment({
      provider,
      paymentStatus: "success",
      reference,
      expectedAmount: amount,
      userId: context.user.id,
    });

    const admin = createAdminClient();

    let school = context.school ?? null;
    let schoolCode = String(context.school?.code ?? "").trim();
    const alreadyExists = Boolean(school?.id);

    if (!school) {
      const created = await insertSchoolWithRetry(admin, {
        schoolName,
        principalName,
        userId: context.user.id,
      });

      school = created.school;
      schoolCode = created.schoolCode;
    }

    await ensurePrincipalMembership(admin, school.id, context.user.id);

    schoolCode = await ensureSchoolCode(admin, {
      schoolId: school.id,
      schoolName,
      userId: context.user.id,
      preferredCode: schoolCode,
    });

    await ensureInitialSubscription(admin, {
      schoolId: school.id,
      amount,
      provider,
      reference,
      forceCreate: !alreadyExists,
    });

    return NextResponse.json(
      {
        ok: true,
        data: {
          schoolId: school.id,
          schoolName: school.name,
          schoolCode,
          amount,
          currency: DEFAULT_CURRENCY,
          redirectTo: "/principal/dashboard",
          alreadyExists,
        },
      },
      { status: 200 }
    );
  } catch (e: unknown) {
    const message =
      e instanceof Error ? e.message : "Failed to complete onboarding";

    return NextResponse.json(
      { ok: false, error: message },
      { status: getErrorStatus(message) }
    );
  }
}
