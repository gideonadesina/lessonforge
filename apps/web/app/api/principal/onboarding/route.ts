import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getBearerTokenFromHeaders, resolvePrincipalContext } from "@/lib/principal/server";
import {
  DEFAULT_CURRENCY,
  DEFAULT_SLOT_PRICE,
  computeSubscriptionAmount,
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

    // Idempotency: if user already has a school they created, return it.
    if (context.school?.id) {
      return NextResponse.json(
        {
          ok: true,
          data: {
            schoolId: context.school.id,
            schoolName: context.school.name,
            schoolCode: context.school.code,
            teacherSlots,
            redirectTo: "/principal",
            alreadyExists: true,
          },
        },
        { status: 200 }
      );
    }

    const schoolCode = generateSchoolCode(schoolName);
    const school = await insertSchool(admin, {
      schoolName,
      principalName,
      userId: context.user.id,
      code: schoolCode,
    });

    const memberRes = await admin.from("school_members").insert({
      school_id: school.id,
      user_id: context.user.id,
      role: "principal",
      status: "active",
    });
    if (memberRes.error && !isMissingTableOrColumnError(memberRes.error) && String(memberRes.error.code ?? "") !== "23505") {
      return NextResponse.json({ ok: false, error: memberRes.error.message }, { status: 500 });
    }

    const slotRes = await admin.from("teacher_slots").insert({
      school_id: school.id,
      slot_limit: teacherSlots,
      slot_price: DEFAULT_SLOT_PRICE,
      currency: DEFAULT_CURRENCY,
      status: "active",
    });
    if (slotRes.error && !isMissingTableOrColumnError(slotRes.error)) {
      return NextResponse.json({ ok: false, error: slotRes.error.message }, { status: 500 });
    }

    const codeRes = await admin.from("school_codes").insert({
      school_id: school.id,
      code: schoolCode,
      is_active: true,
      generated_by: context.user.id,
    });
    if (codeRes.error && !isMissingTableOrColumnError(codeRes.error)) {
      return NextResponse.json({ ok: false, error: codeRes.error.message }, { status: 500 });
    }

    // Keep schools.code in sync for backwards compatibility.
    await admin.from("schools").update({ code: schoolCode }).eq("id", school.id);

    const amount = computeSubscriptionAmount(teacherSlots, DEFAULT_SLOT_PRICE);
    const subRes = await admin.from("subscriptions").insert({
      school_id: school.id,
      amount,
      currency: DEFAULT_CURRENCY,
      status: "paid",
      provider: body?.payment?.provider ?? "placeholder",
      reference: body?.payment?.reference ?? null,
      teacher_slots: teacherSlots,
      billing_cycle: "monthly",
      paid_at: new Date().toISOString(),
    });
    if (subRes.error && !isMissingTableOrColumnError(subRes.error)) {
      return NextResponse.json({ ok: false, error: subRes.error.message }, { status: 500 });
    }

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
        },
      },
      { status: 200 }
    );
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Failed to complete onboarding";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}