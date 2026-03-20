import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getBearerTokenFromHeaders, resolvePrincipalContext } from "@/lib/principal/server";
import {
  DEFAULT_CURRENCY,
  DEFAULT_SLOT_PRICE,
  computeSubscriptionAmount,
  generateLicenseCode,
  generateSchoolCode,
  isMissingTableOrColumnError,
  sanitizeSlotCount,
} from "@/lib/principal/utils";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

type OnboardingPayload = {
  principalName: string;
  schoolName: string;
  teacherSlots: number;
  payment?: {
    provider?: "placeholder" | "paystack";
    status?: "success" | "pending" | "failed";
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

function isUniqueViolation(error: unknown) {
  const err = error as { code?: string; message?: string } | null;
  return String(err?.code ?? "") === "23505" || String(err?.message ?? "").toLowerCase().includes("duplicate key");
}

async function insertSchool(
  admin: ReturnType<typeof createAdminClient>,
  input: { schoolName: string; principalName: string; userId: string; code: string; licenseCode: string }
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

async function insertSchoolWithRetry(
  admin: ReturnType<typeof createAdminClient>,
  input: { schoolName: string; principalName: string; userId: string }
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
      return { school, schoolCode };
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

async function ensureTeacherSlots(
  admin: ReturnType<typeof createAdminClient>,
  schoolId: string,
  teacherSlots: number
) {
  const currentSlotRes = await admin
    .from("teacher_slots")
    .select("slot_limit")
    .eq("school_id", schoolId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (currentSlotRes.error && !isMissingTableOrColumnError(currentSlotRes.error)) {
    throw new Error(currentSlotRes.error.message);
  }
  if (!currentSlotRes.error && Number(currentSlotRes.data?.slot_limit) === teacherSlots) {
    return;
  }

  let slotRes = await admin.from("teacher_slots").insert({
    school_id: schoolId,
    slot_limit: teacherSlots,
    slot_price: DEFAULT_SLOT_PRICE,
    currency: DEFAULT_CURRENCY,
    status: "active",
  });

  if (slotRes.error && isMissingTableOrColumnError(slotRes.error)) {
    slotRes = await admin.from("teacher_slots").insert({
      school_id: schoolId,
      slot_limit: teacherSlots,
    });
  }

  if (slotRes.error && !isMissingTableOrColumnError(slotRes.error)) {
    throw new Error(slotRes.error.message);
  }
}

async function ensureSchoolCode(
  admin: ReturnType<typeof createAdminClient>,
  input: { schoolId: string; schoolName: string; userId: string; preferredCode?: string | null }
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

  const schoolUpdate = await admin.from("schools").update({ code: schoolCode }).eq("id", input.schoolId);
  if (schoolUpdate.error && !isMissingTableOrColumnError(schoolUpdate.error)) {
    throw new Error(schoolUpdate.error.message);
  }

  return schoolCode;
}

async function ensureInitialSubscription(
  admin: ReturnType<typeof createAdminClient>,
  input: {
    schoolId: string;
    teacherSlots: number;
    amount: number;
    provider: "placeholder" | "paystack";
    reference: string | null;
    forceCreate: boolean;
  }
) {
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
    teacher_slots: input.teacherSlots,
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

export async function POST(req: NextRequest) {
  try {
    const token = getBearerTokenFromHeaders(req.headers);
    const context = await resolvePrincipalContext(token);

    if (!context.ok || !context.user) {
      return NextResponse.json({ ok: false, error: context.error ?? "Unauthorized" }, { status: context.status ?? 401 });
    }

    if (context.isTeacherOnly) {
      return NextResponse.json(
        { ok: false, error: "Teacher accounts cannot create principal workspaces." },
        { status: 403 }
      );
    }

    const body = (await req.json().catch(() => null)) as OnboardingPayload | null;
    const principalName = String(body?.principalName ?? "").trim();
    const schoolName = String(body?.schoolName ?? "").trim();
    const teacherSlots = sanitizeSlotCount(body?.teacherSlots ?? 1);
    const paymentStatus = body?.payment?.status ?? "pending";

    if (!principalName || !schoolName) {
      return NextResponse.json(
        { ok: false, error: "Principal name and school name are required." },
        { status: 400 }
      );
    }

    if (paymentStatus !== "success") {
      return NextResponse.json(
        { ok: false, error: "Payment is not confirmed. Complete payment before onboarding." },
        { status: 400 }
      );
    }

    const admin = createAdminClient();
    const existingSchool = context.school ?? null;
    let school = existingSchool;
    let schoolCode = String(existingSchool?.code ?? "").trim();
    const amount = computeSubscriptionAmount(teacherSlots, DEFAULT_SLOT_PRICE);

    if (!school?.id) {
      const created = await insertSchoolWithRetry(admin, {
        schoolName,
        principalName,
        userId: context.user.id,
      });
      school = created.school;
      schoolCode = created.schoolCode;
    }

    await ensurePrincipalMembership(admin, school.id, context.user.id);
    await ensureTeacherSlots(admin, school.id, teacherSlots);
    schoolCode = await ensureSchoolCode(admin, {
      schoolId: school.id,
      schoolName,
      userId: context.user.id,
      preferredCode: schoolCode,
    });
    await ensureInitialSubscription(admin, {
      schoolId: school.id,
      teacherSlots,
      amount,
      provider: body?.payment?.provider ?? "placeholder",
      reference: body?.payment?.reference ?? null,
      forceCreate: !existingSchool?.id,
    });

    return NextResponse.json(
      {
        ok: true,
        data: {
          schoolId: school.id,
          schoolName: school.name,
          schoolCode,
          teacherSlots,
          amount,
          currency: DEFAULT_CURRENCY,
          redirectTo: "/principal",
          alreadyExists: Boolean(existingSchool?.id),
        },
      },
      { status: 200 }
    );
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Failed to complete onboarding";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}