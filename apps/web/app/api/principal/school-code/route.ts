import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getBearerTokenFromHeaders, resolveActiveSchoolCode, resolvePrincipalContext } from "@/lib/principal/server";
import { ensurePrincipalBillingActive } from "@/lib/principal/billing";
import { generateSchoolCode, isMissingTableOrColumnError } from "@/lib/principal/utils";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(req: NextRequest) {
  try {
    const token = getBearerTokenFromHeaders(req.headers);
    const context = await resolvePrincipalContext(token);
    if (!context.ok || !context.user) {
      return NextResponse.json({ ok: false, error: context.error ?? "Unauthorized" }, { status: context.status ?? 401 });
    }
    if (!context.school?.id || !context.isPrincipal) {
      return NextResponse.json({ ok: false, error: "Principal workspace not found." }, { status: 404 });
    }

    const code = await resolveActiveSchoolCode(context.school.id, context.school.code ?? null);
    return NextResponse.json({ ok: true, data: { schoolCode: code } }, { status: 200 });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Failed to load school code";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const token = getBearerTokenFromHeaders(req.headers);
    const context = await resolvePrincipalContext(token);

    if (!context.ok || !context.user) {
      return NextResponse.json({ ok: false, error: context.error ?? "Unauthorized" }, { status: context.status ?? 401 });
    }
    if (!context.school?.id || !context.isPrincipal) {
      return NextResponse.json({ ok: false, error: "Principal workspace not found." }, { status: 404 });
    }

    const schoolId = context.school.id;
    const admin = createAdminClient();
    const billingGuard = await ensurePrincipalBillingActive(admin, schoolId);
    if (!billingGuard.ok) {
      return NextResponse.json({ ok: false, error: billingGuard.error, billing: billingGuard.billing }, { status: billingGuard.status });
    }
    const newCode = generateSchoolCode(context.school.name ?? "LessonForge School");

    const deactivateRes = await admin
      .from("school_codes")
      .update({ is_active: false })
      .eq("school_id", schoolId)
      .eq("is_active", true);

    if (deactivateRes.error && !isMissingTableOrColumnError(deactivateRes.error)) {
      return NextResponse.json({ ok: false, error: deactivateRes.error.message }, { status: 500 });
    }

    const insertRes = await admin.from("school_codes").insert({
      school_id: schoolId,
      code: newCode,
      is_active: true,
      generated_by: context.user.id,
    });

    if (insertRes.error && !isMissingTableOrColumnError(insertRes.error)) {
      return NextResponse.json({ ok: false, error: insertRes.error.message }, { status: 500 });
    }

    const schoolUpdate = await admin.from("schools").update({ code: newCode }).eq("id", schoolId);
    if (schoolUpdate.error && !isMissingTableOrColumnError(schoolUpdate.error)) {
      return NextResponse.json({ ok: false, error: schoolUpdate.error.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true, data: { schoolCode: newCode } }, { status: 200 });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Failed to regenerate code";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}