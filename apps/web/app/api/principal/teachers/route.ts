import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getBearerTokenFromHeaders, resolvePrincipalContext } from "@/lib/principal/server";
import { isMissingTableOrColumnError } from "@/lib/principal/utils";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

type TeacherActionPayload = {
  teacherUserId: string;
  action: "disable" | "remove" | "activate";
};

export async function PATCH(req: NextRequest) {
  try {
    const token = getBearerTokenFromHeaders(req.headers);
    const context = await resolvePrincipalContext(token);
    if (!context.ok || !context.user) {
      return NextResponse.json({ ok: false, error: context.error ?? "Unauthorized" }, { status: context.status ?? 401 });
    }
    if (!context.school?.id || !context.isPrincipal) {
      return NextResponse.json({ ok: false, error: "Principal workspace not found." }, { status: 404 });
    }

    const body = (await req.json().catch(() => null)) as TeacherActionPayload | null;
    const teacherUserId = String(body?.teacherUserId ?? "").trim();
    const action = body?.action;

    if (!teacherUserId || !action) {
      return NextResponse.json({ ok: false, error: "teacherUserId and action are required." }, { status: 400 });
    }

    if (teacherUserId === context.user.id) {
      return NextResponse.json({ ok: false, error: "Principal account cannot be modified here." }, { status: 400 });
    }

    const admin = createAdminClient();

    if (action === "remove") {
      const delRes = await admin
        .from("school_members")
        .delete()
        .eq("school_id", context.school.id)
        .eq("user_id", teacherUserId);

      if (delRes.error) {
        return NextResponse.json({ ok: false, error: delRes.error.message }, { status: 500 });
      }

      return NextResponse.json(
        { ok: true, data: { teacherUserId, action, status: "removed" } },
        { status: 200 }
      );
    }

    const updatePayload =
      action === "disable"
        ? { role: "disabled_teacher", status: "disabled" }
        : { role: "teacher", status: "active" };

    const updateRes = await admin
      .from("school_members")
      .update(updatePayload)
      .eq("school_id", context.school.id)
      .eq("user_id", teacherUserId);

    if (updateRes.error && !isMissingTableOrColumnError(updateRes.error)) {
      return NextResponse.json({ ok: false, error: updateRes.error.message }, { status: 500 });
    }

    if (updateRes.error && isMissingTableOrColumnError(updateRes.error)) {
      // Backward compatibility with minimal school_members schema.
      const fallbackRes = await admin
        .from("school_members")
        .update({ role: action === "disable" ? "disabled_teacher" : "teacher" })
        .eq("school_id", context.school.id)
        .eq("user_id", teacherUserId);

      if (fallbackRes.error) {
        return NextResponse.json({ ok: false, error: fallbackRes.error.message }, { status: 500 });
      }
    }

    return NextResponse.json(
      {
        ok: true,
        data: {
          teacherUserId,
          action,
          status: action === "disable" ? "disabled" : "active",
        },
      },
      { status: 200 }
    );
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Failed to update teacher";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}