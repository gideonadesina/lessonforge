import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  getBearerTokenFromHeaders,
  resolvePrincipalContext,
} from "@/lib/principal/server";
import { isMissingTableOrColumnError } from "@/lib/principal/utils";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

type SchoolProfilePayload = {
  schoolName?: unknown;
  principalName?: unknown;
};

function clean(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function jsonError(message: string, status: number) {
  return NextResponse.json({ ok: false, error: message }, { status });
}

async function updateSchoolProfile(input: {
  schoolId: string;
  schoolName: string;
  principalName: string;
  hasPrincipalName: boolean;
}) {
  const admin = createAdminClient();
  const basePatch: Record<string, unknown> = {
    name: input.schoolName,
    updated_at: new Date().toISOString(),
  };
  if (input.hasPrincipalName) basePatch.principal_name = input.principalName || null;

  const attempts: Array<{ patch: Record<string, unknown>; select: string }> = [];
  attempts.push({
    patch: basePatch,
    select: "id, name, principal_name, created_at",
  });
  attempts.push({
    patch: { name: input.schoolName },
    select: "id, name, created_at",
  });

  let lastError: string | null = null;
  for (const attempt of attempts) {
    const res = await admin
      .from("schools")
      .update(attempt.patch)
      .eq("id", input.schoolId)
      .select(attempt.select)
      .maybeSingle();

    if (!res.error) {
      const row = (res.data ?? {}) as Record<string, unknown>;
      return {
        id: String(row.id ?? input.schoolId),
        name: String(row.name ?? input.schoolName),
        principalName:
          typeof row.principal_name === "string"
            ? row.principal_name
            : input.hasPrincipalName
              ? input.principalName || null
              : null,
        createdAt: typeof row.created_at === "string" ? row.created_at : null,
      };
    }

    if (!isMissingTableOrColumnError(res.error)) {
      lastError = res.error.message;
      break;
    }
    lastError = res.error.message;
  }

  throw new Error(lastError ?? "Failed to update school profile.");
}

export async function PATCH(req: NextRequest) {
  try {
    const token = getBearerTokenFromHeaders(req.headers);
    const context = await resolvePrincipalContext(token);

    if (!context.ok || !context.user) {
      return jsonError(context.error ?? "Unauthorized", context.status ?? 401);
    }
    if (context.isTeacherOnly || !context.isPrincipal) {
      return jsonError("Principal access required.", 403);
    }
    if (!context.school?.id) {
      return jsonError("No school workspace found for this principal.", 404);
    }

    const body = (await req.json().catch(() => null)) as SchoolProfilePayload | null;
    const schoolName = clean(body?.schoolName);
    const principalName = clean(body?.principalName);

    if (!schoolName) {
      return jsonError("School name is required.", 400);
    }

    const updated = await updateSchoolProfile({
      schoolId: context.school.id,
      schoolName,
      principalName,
      hasPrincipalName: Boolean(body && "principalName" in body),
    });

    return NextResponse.json({ ok: true, data: { school: updated } }, { status: 200 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to update school profile.";
    return jsonError(message, 500);
  }
}
