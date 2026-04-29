import { NextRequest, NextResponse } from "next/server";

import { createAdminClient } from "@/lib/supabase/admin";
import { isMissingTableOrColumnError } from "@/lib/principal/utils";
import {
  resolveAuthRoleContextFromToken,
  type AuthRoleContext,
} from "@/lib/auth/role-context";
import {
  ROLE_COOKIE_KEY,
  type AppRole,
  getRoleHomePath,
  normalizeRole,
  resolvePreferredRole,
  rolesFromUserMetadata,
} from "@/lib/auth/roles";
import { sendEmail } from "@/lib/emails/send";
import { welcomeEmail } from "@/lib/emails/templates";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

type RoleSwitchPayload = {
  role?: string;
  claimIfUnprovisioned?: boolean;
};

function readMetadataRoles(metadata: Record<string, unknown>): AppRole[] {
  return rolesFromUserMetadata(metadata);
}

function getFirstName(value: unknown, fallback = "there") {
  const name = String(value ?? "").trim();
  if (!name) return fallback;
  return name.split(/\s+/)[0] || fallback;
}

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

  // Step 1: Create or update the profile without role first
  console.log(`Bootstrapping role ${input.nextRole} for user ${input.userId}`);
  const { data: existingProfile } = await admin
    .from("profiles")
    .select("id")
    .eq("id", input.userId)
    .maybeSingle();
  const profileUpsert = await admin.from("profiles").upsert(profileBase);
  if (profileUpsert.error) {
    console.error("Failed to upsert profile during bootstrap:", profileUpsert.error.message);
    throw new Error(`Profile creation failed: ${profileUpsert.error.message}`);
  }
  console.log("Profile upsert successful");

  if (!existingProfile?.id && input.email) {
    await sendEmail({
      to: input.email,
      subject: "Welcome to LessonForge",
      html: welcomeEmail({ firstName: getFirstName(fullName) }),
    });
  }

  // Step 2: Try to update the role column if it exists
  const roleUpdate = await admin
    .from("profiles")
    .update({ role: input.nextRole })
    .eq("id", input.userId);
  if (roleUpdate.error) {
    if (isMissingTableOrColumnError(roleUpdate.error)) {
      console.log("Role column not available, skipping role update in profiles");
    } else {
      console.error("Failed to update role in profiles during bootstrap:", roleUpdate.error.message);
    }
  } else {
    console.log("Role updated in profiles");
  }

  // Step 3: Update app_role if possible
  const profileAppRolePatch = await admin
    .from("profiles")
    .update({ app_role: input.nextRole })
    .eq("id", input.userId);
  if (profileAppRolePatch.error) {
    if (isMissingTableOrColumnError(profileAppRolePatch.error)) {
      console.log("app_role column not available, skipping app_role update");
    } else {
      console.error("Failed to update app_role in profiles during bootstrap:", profileAppRolePatch.error.message);
    }
  } else {
    console.log("app_role updated in profiles");
  }

  // Step 4: Update auth metadata
  const metadataPatch: Record<string, unknown> = {
    ...(metadata ?? {}),
    app_role: input.nextRole,
    app_roles: Array.from(
      new Set([
        ...readMetadataRoles(metadata),
        normalizeRole(metadata.app_role) ?? null,
        input.nextRole,
      ].filter(Boolean))
    ),
  };
  if (fullName) {
    metadataPatch.full_name = fullName;
  }

  const authUpdate = await admin.auth.admin.updateUserById(input.userId, {
    user_metadata: metadataPatch,
  });
  if (authUpdate.error) {
    console.error("Failed to update auth metadata during bootstrap:", authUpdate.error.message);
  } else {
    console.log("Auth metadata updated");
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
      error instanceof Error ? error.message : "Failed to switch role";
    console.error("POST /api/auth/roles failed:", error);
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
    const claimIfUnprovisioned = Boolean(body?.claimIfUnprovisioned);
    console.log("[roles] requested role:", nextRole ?? body?.role ?? null);
    console.log("[roles] claimIfUnprovisioned:", claimIfUnprovisioned);
    console.log("[roles] user roles before:", result.context.availableRoles);
    if (!nextRole) {
      return NextResponse.json(
        { ok: false, error: "A valid role is required." },
        { status: 400 }
      );
    }

    if (!result.context.availableRoles.includes(nextRole)) {
      if (
        claimIfUnprovisioned &&
        (result.context.availableRoles.length === 0 || nextRole === "principal")
      ) {
        await bootstrapInitialRole({
          userId: result.user.id,
          email: result.user.email ?? null,
          userMetadata:
            (result.user.user_metadata as Record<string, unknown> | null) ?? null,
          nextRole,
        });

        const activeRole = nextRole;
        console.log("[roles] active role after:", activeRole);
        const response = NextResponse.json(
          {
            ok: true,
            data: {
              activeRole,
              homePath: getRoleHomePath(activeRole),
            },
          },
          { status: 200 }
        );
        response.cookies.set(ROLE_COOKIE_KEY, activeRole, {
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

    const activeRole = nextRole;
    console.log("[roles] active role after:", activeRole);
    const response = NextResponse.json(
      {
        ok: true,
        data: {
          activeRole,
          homePath: getRoleHomePath(activeRole),
        },
      },
      { status: 200 }
    );
    response.cookies.set(ROLE_COOKIE_KEY, activeRole, {
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
