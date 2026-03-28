import { NextRequest, NextResponse } from "next/server";

import { createAdminClient } from "@/lib/supabase/admin";
import { isMissingTableOrColumnError } from "@/lib/principal/utils";
import {
  resolveAuthRoleContextFromToken,
  type AuthRoleContext,
} from "@/lib/auth/role-context";
import {
  ROLE_COOKIE_KEY,
  getRoleHomePath,
  normalizeRole,
  resolvePreferredRole,
} from "@/lib/auth/roles";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

type RoleSwitchPayload = {
  role?: string;
  claimIfUnprovisioned?: boolean;
};

function getBearerTokenFromHeaders(headers: Headers) {
  const auth = headers.get("authorization") ?? "";
  return auth.startsWith("Bearer ") ? auth.slice(7) : "";
}

function getRolePayload(context: AuthRoleContext, cookiePreferredRole: string | null) {
  const preferredRole = normalizeRole(cookiePreferredRole);
  const activeRole = resolvePreferredRole(context.availableRoles, preferredRole, {
    allowNullWhenMultiple: true,
  });
  const needsRoleSelection = context.availableRoles.length > 1 && !activeRole;

  return {
    availableRoles: context.availableRoles,
    activeRole,
    needsRoleSelection,
    hasTeacherAccess: context.hasTeacherAccess,
    hasPrincipalAccess: context.hasPrincipalAccess,
    isRegistered: context.isRegistered,
    roleHomes: {
      teacher: getRoleHomePath("teacher"),
      principal: getRoleHomePath("principal"),
    },
  };
}

async function bootstrapInitialRole(input: {
  userId: string;
  email: string | null;
  userMetadata: Record<string, unknown> | null;
  nextRole: "teacher" | "principal";
}) {
  const admin = createAdminClient();
  const metadata = input.userMetadata ?? {};
  const fullName =
    (typeof metadata.full_name === "string" ? metadata.full_name : "") ||
    (typeof metadata.name === "string" ? metadata.name : "") ||
    (input.email ?? "").split("@")[0] ||
    "";
  const profileBase = {
    id: input.userId,
    email: input.email ?? "",
    full_name: fullName,
    updated_at: new Date().toISOString(),
  };

  const withRole = await admin.from("profiles").upsert({
    ...profileBase,
    role: input.nextRole,
  });
  if (withRole.error && !isMissingTableOrColumnError(withRole.error)) {
    throw new Error(withRole.error.message);
  }

  if (withRole.error && isMissingTableOrColumnError(withRole.error)) {
    const fallback = await admin.from("profiles").upsert(profileBase);
    if (fallback.error && !isMissingTableOrColumnError(fallback.error)) {
      throw new Error(fallback.error.message);
    }
  }

  const profileAppRolePatch = await admin
    .from("profiles")
    .update({ app_role: input.nextRole })
    .eq("id", input.userId);
  if (
    profileAppRolePatch.error &&
    !isMissingTableOrColumnError(profileAppRolePatch.error)
  ) {
    throw new Error(profileAppRolePatch.error.message);
  }

  const metadataPatch: Record<string, unknown> = {
    ...(metadata ?? {}),
    app_role: input.nextRole,
  };
  if (fullName) {
    metadataPatch.full_name = fullName;
  }

  const authUpdate = await admin.auth.admin.updateUserById(input.userId, {
    user_metadata: metadataPatch,
  });
  if (authUpdate.error) {
    throw new Error(authUpdate.error.message);
  }
}

export async function GET(req: NextRequest) {
  try {
    const token = getBearerTokenFromHeaders(req.headers);
    const result = await resolveAuthRoleContextFromToken(token);

    if (!result.ok || !result.context) {
      return NextResponse.json(
        { ok: false, error: result.error ?? "Unauthorized" },
        { status: result.status ?? 401 }
      );
    }

    const payload = getRolePayload(
      result.context,
      req.cookies.get(ROLE_COOKIE_KEY)?.value ?? null
    );

    return NextResponse.json({ ok: true, data: payload }, { status: 200 });
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : "Failed to load role context";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const token = getBearerTokenFromHeaders(req.headers);
    const result = await resolveAuthRoleContextFromToken(token);

    if (!result.ok || !result.context || !result.user) {
      return NextResponse.json(
        { ok: false, error: result.error ?? "Unauthorized" },
        { status: result.status ?? 401 }
      );
    }

    const body = (await req.json().catch(() => null)) as RoleSwitchPayload | null;
    const nextRole = normalizeRole(body?.role ?? null);
    if (!nextRole) {
      return NextResponse.json(
        { ok: false, error: "A valid role is required." },
        { status: 400 }
      );
    }

    if (!result.context.availableRoles.includes(nextRole)) {
      if (
        Boolean(body?.claimIfUnprovisioned) &&
        result.context.availableRoles.length === 0
      ) {
        await bootstrapInitialRole({
          userId: result.user.id,
          email: result.user.email ?? null,
          userMetadata:
            (result.user.user_metadata as Record<string, unknown> | null) ?? null,
          nextRole,
        });

        const response = NextResponse.json(
          {
            ok: true,
            data: {
              activeRole: nextRole,
              homePath: getRoleHomePath(nextRole),
            },
          },
          { status: 200 }
        );
        response.cookies.set(ROLE_COOKIE_KEY, nextRole, {
          path: "/",
          maxAge: 60 * 60 * 24 * 365,
          sameSite: "lax",
        });
        return response;
      }

      return NextResponse.json(
        { ok: false, error: "You do not have access to that role." },
        { status: 403 }
      );
    }

    const response = NextResponse.json(
      {
        ok: true,
        data: {
          activeRole: nextRole,
          homePath: getRoleHomePath(nextRole),
        },
      },
      { status: 200 }
    );
    response.cookies.set(ROLE_COOKIE_KEY, nextRole, {
      path: "/",
      maxAge: 60 * 60 * 24 * 365,
      sameSite: "lax",
    });
    return response;
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : "Failed to switch role";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
