import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getBearerTokenFromHeaders, resolvePrincipalContext } from "@/lib/principal/server";
import { paystackHeaders } from "@/lib/paystack";
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
  principalName?: string;
  schoolName?: string;
  teacherSlots?: number;
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
    const teacherSlots = sanitizeSlotCount(metadata?.teacher_slots ?? body?.teacherSlots ?? 1);
    if (!principalName || !schoolName) {
      return NextResponse.json({ ok: false, error: "Principal name and school name are required." }, { status: 400 });
    }

    const expectedAmount = computeSubscriptionAmount(teacherSlots, DEFAULT_SLOT_PRICE);
    const expectedAmountFromMeta = parsePositiveNumber(metadata?.expected_amount_major);
    const expectedMajorAmount = expectedAmountFromMeta ?? expectedAmount;
    const paidAmountMajor = Math.round(Number(verified.amount ?? 0)) / 100;
    if (!Number.isFinite(paidAmountMajor) || paidAmountMajor !== expectedMajorAmount) {
      return NextResponse.json(
        {
          ok: false,
          error: "Paid amount did not match expected amount.",
          expected: expectedMajorAmount,
          paid: paidAmountMajor,
        },
        { status: 400 }
      );
    }

    const admin = createAdminClient();
    const existingByReference = await admin
      .from("subscriptions")
      .select("school_id, amount, currency, teacher_slots, paid_at")
      .eq("provider", "paystack")
      .eq("reference", paymentReference)
      .maybeSingle();
    if (existingByReference.error && !isMissingTableOrColumnError(existingByReference.error)) {
      return NextResponse.json({ ok: false, error: existingByReference.error.message }, { status: 500 });
    }

    if (existingByReference.data?.school_id) {
      const schoolRes = await admin
        .from("schools")
        .select("id, name, code, created_at")
        .eq("id", existingByReference.data.school_id)
        .maybeSingle();
      if (schoolRes.error && !isMissingTableOrColumnError(schoolRes.error)) {
        return NextResponse.json({ ok: false, error: schoolRes.error.message }, { status: 500 });
      }

      const existingSchool = schoolRes.data;
      return NextResponse.json(
        {
          ok: true,
          data: {
            schoolId: existingSchool?.id ?? existingByReference.data.school_id,
            schoolName: existingSchool?.name ?? context.school?.name ?? schoolName,
            schoolCode: existingSchool?.code ?? context.school?.code ?? null,
            teacherSlots: Number(existingByReference.data.teacher_slots ?? teacherSlots),
            amount: Number(existingByReference.data.amount ?? expectedMajorAmount),
            currency: (existingByReference.data.currency ?? DEFAULT_CURRENCY) as typeof DEFAULT_CURRENCY,
            redirectTo: "/principal",
            alreadyExists: true,
          },
        },
        { status: 200 }
      );
    }

    let schoolCode = context.school?.code ?? null;
    const school =
      context.school?.id
        ? ({
            id: context.school.id,
            name: context.school.name,
            code: context.school.code,
            created_at: context.school.created_at,
            created_by: context.user.id,
            principal_name: context.school.principal_name ?? principalName,
          } as SchoolInsertRecord)
        : await insertSchool(admin, {
            schoolName,
            principalName,
            userId: context.user.id,
            code: generateSchoolCode(schoolName),
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

    if (!schoolCode) {
      schoolCode = generateSchoolCode(schoolName);
      const codeRes = await admin.from("school_codes").insert({
        school_id: school.id,
        code: schoolCode,
        is_active: true,
        generated_by: context.user.id,
      });
      if (codeRes.error && !isMissingTableOrColumnError(codeRes.error)) {
        return NextResponse.json({ ok: false, error: codeRes.error.message }, { status: 500 });
      }
    }

    // Keep schools.code in sync for backwards compatibility.
    if (schoolCode) {
      await admin.from("schools").update({ code: schoolCode }).eq("id", school.id);
    }

    const amount = expectedMajorAmount;
    const subscriptionBase = {
      school_id: school.id,
      amount,
      currency: DEFAULT_CURRENCY,
      status: "paid",
      provider: "paystack",
      reference: paymentReference,
      teacher_slots: teacherSlots,
      billing_cycle: "monthly",
      paid_at: verified.paid_at ?? new Date().toISOString(),
    };

    let subRes = await admin.from("subscriptions").insert({
      ...subscriptionBase,
      provider_metadata: {
        paystack_reference: paymentReference,
        paystack_status: verified.status,
        paystack_amount_minor: verified.amount,
        expected_amount_major: expectedMajorAmount,
        teacher_slots: teacherSlots,
      },
    });
    if (subRes.error && String(subRes.error.code ?? "") !== "23505") {
      subRes = await admin.from("subscriptions").insert(subscriptionBase);
    }

    const subCode = String(subRes.error?.code ?? "");
    if (subRes.error && subCode !== "23505" && !isMissingTableOrColumnError(subRes.error)) {
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