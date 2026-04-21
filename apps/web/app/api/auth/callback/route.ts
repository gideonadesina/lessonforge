/**
 * API: OAuth Callback Handler
 *
 * Server-side processing of OAuth flows:
 * 1. Verify session exists (Supabase client already exchanged the code)
 * 2. Create/find user profile
 * 3. Resolve available roles
 * 4. Claim initial role if needed
 * 5. Set active role cookie
 * 6. Return redirect URL
 *
 * This is called by the client after Supabase has handled the OAuth code exchange.
 */

import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { createAdminClient } from "@/lib/supabase/admin";
import { isAppRole, type AppRole, ROLE_COOKIE_KEY, getRoleHomePath } from "@/lib/auth/roles";
import { resolveAuthRoleContext } from "@/lib/auth/role-context";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 10;

interface CallbackResponse {
  ok: boolean;
  redirectUrl?: string;
  error?: string;
  stage?: string;
}

export async function POST(req: NextRequest): Promise<NextResponse<CallbackResponse>> {
  const stages: string[] = [];
  const startTime = Date.now();

  try {
    console.log("[API /auth/callback] START");

    // ==================== Stage 1: Get Session ====================
    stages.push("getting_session");

    const cookieStore = await cookies();
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll: () => cookieStore.getAll(),
          setAll: (cookiesToSet) => {
            cookiesToSet.forEach(({ name, value, options }) => {
              cookieStore.set(name, value, options);
            });
          },
        },
      }
    );

    const { data: authData, error: sessionError } = await supabase.auth.getSession();

    if (sessionError) {
      console.error("[API /auth/callback] Session error:", sessionError.message);
      return NextResponse.json(
        {
          ok: false,
          stage: "getting_session",
          error: `Session error: ${sessionError.message}`,
        },
        { status: 401 }
      );
    }

    const session = authData?.session;
    const user = session?.user;

    if (!user?.id || !user.email) {
      console.error("[API /auth/callback] No valid session");
      return NextResponse.json(
        {
          ok: false,
          stage: "getting_session",
          error: "No valid session. Please sign in again.",
        },
        { status: 401 }
      );
    }

    console.log("[API /auth/callback] Session found", {
      userId: user.id,
      email: user.email,
    });

    // ==================== Stage 2: Ensure Profile ====================
    stages.push("ensuring_profile");

    await ensureUserProfile(user.id, {
      email: user.email,
      fullName:
        typeof user.user_metadata?.full_name === "string"
          ? user.user_metadata.full_name
          : typeof user.user_metadata?.name === "string"
          ? user.user_metadata.name
          : null,
    });

    console.log("[API /auth/callback] Profile ensured", { userId: user.id });

    // ==================== Stage 3: Resolve Roles ====================
    stages.push("resolving_roles");

    const roleContext = await resolveAuthRoleContext({
      userId: user.id,
      email: user.email,
      metadataRole: isAppRole(user.user_metadata?.app_role)
        ? user.user_metadata.app_role
        : null,
    });

    console.log("[API /auth/callback] Roles resolved", {
      userId: user.id,
      availableRoles: roleContext.availableRoles,
    });

    // ==================== Stage 4: Determine Target Role ====================
    stages.push("determining_role");

    const targetRole = determineTargetRole({
      availableRoles: roleContext.availableRoles,
      activeRole: roleContext.activeRole as AppRole | null,
    });

    if (!targetRole) {
      console.error("[API /auth/callback] Could not determine role");
      return NextResponse.json(
        {
          ok: false,
          stage: "determining_role",
          error: "Could not determine your workspace role.",
        },
        { status: 400 }
      );
    }

    console.log("[API /auth/callback] Target role determined", {
      userId: user.id,
      targetRole,
      isNew: !roleContext.availableRoles.includes(targetRole),
    });

    // ==================== Stage 5: Claim Role if First Time ====================
    stages.push("claiming_role");

    const isFirstRole = roleContext.availableRoles.length === 0;

    if (isFirstRole) {
      await claimInitialRole(user.id, targetRole, {
        email: user.email,
        fullName:
          typeof user.user_metadata?.full_name === "string"
            ? user.user_metadata.full_name
            : null,
        userMetadata: (user.user_metadata ?? {}) as Record<string, unknown>,
      });

      console.log("[API /auth/callback] Initial role claimed", {
        userId: user.id,
        targetRole,
      });
    } else {
      console.log("[API /auth/callback] Role already available", {
        userId: user.id,
        targetRole,
      });
    }

    // ==================== Stage 6: Set Cookie ====================
    stages.push("setting_cookie");

    const response = NextResponse.json(
      {
        ok: true,
        redirectUrl: getRoleHomePath(targetRole),
      },
      { status: 200 }
    );

    response.cookies.set(ROLE_COOKIE_KEY, targetRole, {
      path: "/",
      maxAge: 31536000, // 1 year
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      httpOnly: false,
    });

    console.log("[API /auth/callback] SUCCESS", {
      userId: user.id,
      targetRole,
      totalMs: Date.now() - startTime,
      stages,
    });

    return response;
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("[API /auth/callback] FAILED", {
      error: message,
      stages,
      stack: error instanceof Error ? error.stack : undefined,
      totalMs: Date.now() - startTime,
    });

    return NextResponse.json(
      {
        ok: false,
        error: message,
        stage: stages[stages.length - 1] || "unknown",
      },
      { status: 500 }
    );
  }
}

/**
 * Ensure user has a profile record. Idempotent.
 */
async function ensureUserProfile(
  userId: string,
  info: {
    email: string | null;
    fullName: string | null;
  }
) {
  const admin = createAdminClient();

  // Check if profile exists
  const { data: existing } = await admin
    .from("profiles")
    .select("id")
    .eq("id", userId)
    .single();

  if (existing?.id) {
    return;
  }

  // Create profile
  const { error } = await admin.from("profiles").insert({
    id: userId,
    email: info.email || "",
    updated_at: new Date().toISOString(),
  });

  if (error) {
    // Handle race condition where another request created it
    if ((error as { code?: string }).code === "23505") {
      console.log("[ensureUserProfile] Race condition - profile created by another request");
      return;
    }
    throw error;
  }
}

/**
 * Claim the initial role for a user with no roles.
 * This should bootstrap the user with their first role claim.
 */
async function claimInitialRole(
  userId: string,
  role: AppRole,
  info: {
    email: string | null;
    fullName: string | null;
    userMetadata: Record<string, unknown>;
  }
) {
  const admin = createAdminClient();

  // Update auth metadata with the role
  const metadata: Record<string, unknown> = {
    ...(info.userMetadata ?? {}),
    app_role: role,
  };

  if (info.fullName) {
    metadata.full_name = info.fullName;
  }

  const { error: authError } = await admin.auth.admin.updateUserById(userId, {
    user_metadata: metadata,
  });

  if (authError) {
    console.error("[claimInitialRole] Failed to update auth metadata:", authError.message);
    throw authError;
  }

  // If the profile has an app_role column, update it
  const { error: profileError } = await admin
    .from("profiles")
    .update({
      app_role: role,
      updated_at: new Date().toISOString(),
    })
    .eq("id", userId);

  if (profileError) {
    // Missing column is not fatal
    if ((profileError as { code?: string }).code?.includes("42703")) {
      console.log("[claimInitialRole] app_role column not available");
      return;
    }
    throw profileError;
  }
}

/**
 * Determine the target role for post-auth redirect.
 * Priority:
 * 1. If no roles exist, default to "teacher" (first-time user)
 * 2. If one role exists, use it
 * 3. If multiple roles exist, use the stored active role or first
 */
function determineTargetRole(roleContext: {
  availableRoles: AppRole[];
  activeRole: AppRole | null;
}): AppRole | null {
  if (roleContext.availableRoles.length === 0) {
    // First-time user - claim teacher role by default
    return "teacher";
  }

  if (roleContext.availableRoles.length === 1) {
    return roleContext.availableRoles[0];
  }

  // Multiple roles - use active role if available, otherwise first
  return roleContext.activeRole || roleContext.availableRoles[0];
}
