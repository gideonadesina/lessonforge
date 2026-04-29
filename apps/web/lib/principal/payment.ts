import { createAdminClient } from "@/lib/supabase/admin";
import {
  DEFAULT_BILLING_CYCLE,
  DEFAULT_CURRENCY,
  isMissingTableOrColumnError,
} from "@/lib/principal/utils";
import { getSchoolPlanPricing } from "@/lib/billing/server-school-pricing";

const PRINCIPAL_PAYSTACK_FLOW = "principal_onboarding";

type SchoolInsertRecord = {
  id: string;
  name: string | null;
  code: string | null;
  created_at: string | null;
  created_by: string | null;
  principal_name?: string | null;
};

type SubscriptionRefRow = {
  id: string;
  school_id: string | null;
  status: string | null;
  reference: string | null;
};

type PaystackCustomerData = {
  email?: string | null;
  customer_code?: string | null;
};

type PrincipalPaystackMetadata = {
  flow?: string;
  user_id?: string;
  tier?: string;
  principal_name?: string;
  school_name?: string;
};

export type PaystackVerifyResponseData = {
  subscription: any;
  reference?: string | null;
  status?: string | null;
  amount?: number | null;
  currency?: string | null;
  paid_at?: string | null;
  customer?: PaystackCustomerData | null;
  metadata?: PrincipalPaystackMetadata | null;
};

export type PrincipalActivationResult = {
  ok: boolean;
  reference: string;
  schoolId: string;
  schoolName: string;
  schoolCode: string;
  amount: number;
  currency: "NGN" | "USD";
  alreadyActivated: boolean;
};

function getMetadataValue(metadata: PrincipalPaystackMetadata | null | undefined, key: keyof PrincipalPaystackMetadata) {
  return metadata?.[key];
}

function normalizeCurrency(value: string | null | undefined): "NGN" | "USD" {
  return String(value ?? DEFAULT_CURRENCY).toUpperCase() === "USD" ? "USD" : "NGN";
}

function normalizePrincipalReference(reference: string) {
  return reference
    .trim()
    .replace(/[^a-zA-Z0-9_-]/g, "")
    .slice(0, 120);
}

function buildDeterministicSchoolCode(schoolName: string, reference: string) {
  const words = (schoolName || "LessonForge School")
    .toUpperCase()
    .replace(/[^A-Z0-9\s]/g, " ")
    .trim()
    .split(/\s+/)
    .filter(Boolean);

  const initials = (words.map((w) => w[0]).join("").slice(0, 4) || "LFSC").padEnd(4, "X");
  const suffix = reference.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(-6).padStart(6, "X");
  return `${initials}-${suffix}`;
}

function isUniqueViolation(error: unknown) {
  const err = error as { code?: string } | null;
  return String(err?.code ?? "") === "23505";
}

async function getSchoolById(admin: ReturnType<typeof createAdminClient>, schoolId: string) {
  const schoolRes = await admin
    .from("schools")
    .select("id, name, code, created_at, created_by, principal_name")
    .eq("id", schoolId)
    .maybeSingle();
  if (schoolRes.error) {
    throw new Error(schoolRes.error.message);
  }
  return (schoolRes.data as SchoolInsertRecord | null) ?? null;
}

async function getMostRecentPrincipalSchool(admin: ReturnType<typeof createAdminClient>, userId: string) {
  const byCreatorRes = await admin
    .from("schools")
    .select("id, name, code, created_at, created_by, principal_name")
    .eq("created_by", userId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (byCreatorRes.error) {
    throw new Error(byCreatorRes.error.message);
  }

  return (byCreatorRes.data as SchoolInsertRecord | null) ?? null;
}

async function insertSchool(
  admin: ReturnType<typeof createAdminClient>,
  input: { schoolName: string; principalName: string; userId: string; code: string }
): Promise<SchoolInsertRecord> {
  const withPrincipalRes = await admin
    .from("schools")
    .insert({
      name: input.schoolName,
      created_by: input.userId,
      code: input.code,
      principal_name: input.principalName,
    })
    .select("id, name, code, created_at, created_by, principal_name")
    .single();

  if (!withPrincipalRes.error) {
    return withPrincipalRes.data as SchoolInsertRecord;
  }

  if (isUniqueViolation(withPrincipalRes.error)) {
    const existing = await admin
      .from("schools")
      .select("id, name, code, created_at, created_by, principal_name")
      .eq("code", input.code)
      .maybeSingle();

    if (existing.error && !isMissingTableOrColumnError(existing.error)) {
      throw new Error(existing.error.message);
    }
    if (existing.data) {
      return existing.data as SchoolInsertRecord;
    }
  }

  if (!isMissingTableOrColumnError(withPrincipalRes.error)) {
    throw new Error(withPrincipalRes.error.message);
  }

  const fallbackRes = await admin
    .from("schools")
    .insert({
      name: input.schoolName,
      created_by: input.userId,
      code: input.code,
    })
    .select("id, name, code, created_at, created_by")
    .single();

  if (fallbackRes.error) {
    throw new Error(fallbackRes.error.message);
  }

  return fallbackRes.data as SchoolInsertRecord;
}

async function ensurePrincipalMembership(
  admin: ReturnType<typeof createAdminClient>,
  schoolId: string,
  userId: string
) {
  const insertWithStatus = await admin.from("school_members").insert({
    school_id: schoolId,
    user_id: userId,
    role: "principal",
    status: "active",
  });

  if (insertWithStatus.error && isMissingTableOrColumnError(insertWithStatus.error)) {
    const fallback = await admin.from("school_members").insert({
      school_id: schoolId,
      user_id: userId,
      role: "principal",
    });
    if (fallback.error && !isUniqueViolation(fallback.error)) {
      throw new Error(fallback.error.message);
    }
    return;
  }

  if (insertWithStatus.error && !isUniqueViolation(insertWithStatus.error)) {
    throw new Error(insertWithStatus.error.message);
  }
}

async function ensureSchoolCode(
  admin: ReturnType<typeof createAdminClient>,
  schoolId: string,
  code: string,
  userId: string
) {
  const activeCode = await admin
    .from("school_codes")
    .select("code")
    .eq("school_id", schoolId)
    .eq("is_active", true)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (activeCode.error && !isMissingTableOrColumnError(activeCode.error)) {
    throw new Error(activeCode.error.message);
  }

  if (!activeCode.data?.code) {
    const codeRes = await admin.from("school_codes").insert({
      school_id: schoolId,
      code,
      is_active: true,
      generated_by: userId,
    });
    if (codeRes.error && !isMissingTableOrColumnError(codeRes.error) && !isUniqueViolation(codeRes.error)) {
      throw new Error(codeRes.error.message);
    }
  }

  const syncSchoolCode = await admin.from("schools").update({ code }).eq("id", schoolId);
  if (syncSchoolCode.error && !isMissingTableOrColumnError(syncSchoolCode.error)) {
    throw new Error(syncSchoolCode.error.message);
  }
}

async function getSubscriptionByReference(admin: ReturnType<typeof createAdminClient>, reference: string) {
  const sub = await admin
    .from("subscriptions")
    .select("id, school_id, status, reference")
    .eq("reference", reference)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (sub.error) {
    throw new Error(sub.error.message);
  }

  return (sub.data as SubscriptionRefRow | null) ?? null;
}

async function saveSubscription(
  admin: ReturnType<typeof createAdminClient>,
  input: {
    schoolId: string;
    amount: number;
    currency: "NGN" | "USD";
    reference: string;
    paidAt: string;
  }
) {
  const existing = await getSubscriptionByReference(admin, input.reference);
  if (existing?.id) {
    const updateRes = await admin
      .from("subscriptions")
      .update({
        school_id: input.schoolId,
        amount: input.amount,
        currency: input.currency,
        status: "paid",
        provider: "paystack",
        billing_cycle: DEFAULT_BILLING_CYCLE,
        paid_at: input.paidAt,
      })
      .eq("id", existing.id);

    if (updateRes.error && !isMissingTableOrColumnError(updateRes.error)) {
      throw new Error(updateRes.error.message);
    }
    return;
  }

  const insertRes = await admin.from("subscriptions").insert({
    school_id: input.schoolId,
    amount: input.amount,
    currency: input.currency,
    status: "paid",
    provider: "paystack",
    reference: input.reference,
    billing_cycle: DEFAULT_BILLING_CYCLE,
    paid_at: input.paidAt,
  });

  if (insertRes.error && isUniqueViolation(insertRes.error)) {
    const existingAfterConflict = await getSubscriptionByReference(admin, input.reference);
    if (existingAfterConflict?.id) {
      return;
    }
  }

  if (insertRes.error) {
    throw new Error(insertRes.error.message);
  }
}

function assertPrincipalMetadata(metadata: PrincipalPaystackMetadata | null | undefined, reference: string) {
  const flow = String(getMetadataValue(metadata, "flow") ?? "");
  if (flow !== PRINCIPAL_PAYSTACK_FLOW) {
    throw new Error("Payment reference is not for principal onboarding.");
  }

  const userId = String(getMetadataValue(metadata, "user_id") ?? "").trim();
  if (!userId) {
    throw new Error("Missing user_id in payment metadata.");
  }

  const principalName = String(getMetadataValue(metadata, "principal_name") ?? "").trim();
  const schoolName = String(getMetadataValue(metadata, "school_name") ?? "").trim();
  if (!principalName || !schoolName) {
    throw new Error("Missing principal or school details in payment metadata.");
  }

  const safeReference = normalizePrincipalReference(reference);
  if (!safeReference) {
    throw new Error("Invalid payment reference.");
  }

  return {
    userId,
    principalName,
    schoolName,
    flow,
    safeReference,
  };
}

export function getPrincipalPaystackFlow() {
  return PRINCIPAL_PAYSTACK_FLOW;
}

export function generatePrincipalPaymentReference(userId: string) {
  const userChunk = userId.replace(/[^a-zA-Z0-9]/g, "").slice(0, 10) || "principal";
  const stamp = Date.now();
  const rand = Math.random().toString(36).slice(2, 8);
  return `lf_principal_${userChunk}_${stamp}_${rand}`;
}

export async function finalizePrincipalActivationFromPaystackData(
  paystackData: PaystackVerifyResponseData
): Promise<PrincipalActivationResult> {
  const reference = String(paystackData.reference ?? "").trim();
  if (!reference) {
    throw new Error("Missing payment reference.");
  }

  const paymentStatus = String(paystackData.status ?? "").toLowerCase();
  if (paymentStatus !== "success") {
    throw new Error(`Payment is not successful (status: ${paymentStatus || "unknown"}).`);
  }

  const metadata = (paystackData.metadata ?? null) as PrincipalPaystackMetadata | null;
  const parsed = assertPrincipalMetadata(metadata, reference);

  const currency = normalizeCurrency(paystackData.currency ?? DEFAULT_CURRENCY);
  const expectedAmount = getSchoolPlanPricing("school_starter")?.priceNaira ?? 35000;
  const settledAmount = Math.round(Number(paystackData.amount ?? 0) / 100);
  if (settledAmount !== expectedAmount) {
    throw new Error("Payment amount mismatch for selected school plan.");
  }

  const admin = createAdminClient();
  const existingSub = await getSubscriptionByReference(admin, parsed.safeReference);
  const existingSubStatus = String(existingSub?.status ?? "").toLowerCase();
  if (existingSub?.school_id && ["paid", "active", "success"].includes(existingSubStatus)) {
    const existingSchool = await getSchoolById(admin, existingSub.school_id);
    if (existingSchool?.id) {
      return {
        ok: true,
        reference: parsed.safeReference,
        schoolId: existingSchool.id,
        schoolName: existingSchool.name ?? parsed.schoolName,
        schoolCode: existingSchool.code ?? buildDeterministicSchoolCode(parsed.schoolName, parsed.safeReference),
        amount: expectedAmount,
        currency,
        alreadyActivated: true,
      };
    }
  }

  let school = await getMostRecentPrincipalSchool(admin, parsed.userId);
  const deterministicCode = school?.code ?? buildDeterministicSchoolCode(parsed.schoolName, parsed.safeReference);
  if (!school?.id) {
    school = await insertSchool(admin, {
      schoolName: parsed.schoolName,
      principalName: parsed.principalName,
      userId: parsed.userId,
      code: deterministicCode,
    });
  }

  await ensurePrincipalMembership(admin, school.id, parsed.userId);
  await ensureSchoolCode(admin, school.id, school.code ?? deterministicCode, parsed.userId);
  await saveSubscription(admin, {
    schoolId: school.id,
    amount: expectedAmount,
    currency,
    reference: parsed.safeReference,
    paidAt: paystackData.paid_at ?? new Date().toISOString(),
  });

  return {
    ok: true,
    reference: parsed.safeReference,
    schoolId: school.id,
    schoolName: school.name ?? parsed.schoolName,
    schoolCode: school.code ?? deterministicCode,
    amount: expectedAmount,
    currency,
    alreadyActivated: false,
  };
}
