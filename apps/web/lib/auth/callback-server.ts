/**
 * Server-side OAuth callback handling and post-auth setup.
 *
 * Responsibilities:
 * - Exchange OAuth code for session
 * - Read authenticated user
 * - Ensure a profile row exists
 * - Resolve available roles
 * - Claim/bootstrap an initial role when needed
 * - Set active role cookie
 * - Return the correct redirect destination
 *
 * This flow is intentionally idempotent and retry-safe.
 */

import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  isAppRole,
  type AppRole,
  ROLE_COOKIE_KEY,
  getRoleHomePath,
  rolesFromUserMetadata,
  normalizeRole,
} from "@/lib/auth/roles";
import {
  resolveAuthRoleContext,
  type AuthRoleContext,
} from "@/lib/auth/role-context";

export type CallbackResult = {
  ok: boolean;
  redirectUrl?: string;
  fallbackUrl?: string;
  error?: string;
  stage?: string;
};

type CallbackConfig = {
  code: string;
  storedIntent?: string | null;
  requestedRole?: string | null;
  timeoutMs?: number;
};

type UserMetadata = {
  app_role?: AppRole;
  full_name?: string;
  name?: string;
  [key: string]: unknown;
};

type ProfileInfo = {
  email: string | null;
  fullName: string | null;
};

type ClaimRoleInfo = {
  email: string | null;
  fullName: string | null;
  userMetadata: Record<string, unknown>;
};

const DEFAULT_TIMEOUT_MS = 8000;

export async function handleOAuthCallback(
  config: CallbackConfig
): Promise<CallbackResult> {
  const cookieStore = await cookies();
  const startTime = Date.now();
  const stages: string[] = [];
  const timeoutMs = config.timeoutMs ?? DEFAULT_TIMEOUT_MS;

  const runStage = async <T>(stage: string, task: () => Promise<T>): Promise<T> => {
    stages.push(stage);
    return withTimeout(task(), timeoutMs, `Timed out during "${stage}"`);
  };

  try {
    console.log("[Auth Callback] START", {
      codePreview: config.code ? `${config.code.slice(0, 10)}...` : null,
      storedIntent: config.storedIntent ?? null,
      requestedRole: config.requestedRole ?? null,
    });

    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll();
          },
          setAll(cookiesToSet) {
            for (const { name, value, options } of cookiesToSet) {
              cookieStore.set(name, value, options);
            }
          },
        },
      }
    );

    // ==================== Stage 1: Exchange code for session ====================
    await runStage("exchanging_code", async () => {
      const { error } = await supabase.auth.exchangeCodeForSession(config.code);

      if (error) {
        throw new Error(`Failed to exchange OAuth code: ${error.message}`);
      }
    });

    // ==================== Stage 2: Get session ====================
    const session = await runStage("getting_session", async () => {
      const { data, error } = await supabase.auth.getSession();

      if (error) {
        throw new Error(`Failed to get session: ${error.message}`);
      }

      if (!data.session) {
        throw new Error("No session found after OAuth callback.");
      }

      return data.session;
    });

    const user = session.user;

   if (!user?.id) {
  logStage("no_session_user", "Missing authenticated user");
  return {
    ok: false,
    stage: "getting_session",
    error: "No authenticated user found. Please try signing in again.",
  };
}

const userEmail: string | null = typeof user.email === "string" ? user.email : null;

    const userMetadata: UserMetadata = normalizeUserMetadata(user.user_metadata);

   console.log("[Auth Callback] Session found", {
  userId: user.id,
  email: userEmail,
});
    // ==================== Stage 3: Ensure profile ====================
    await runStage("ensuring_profile", async () => {
     await ensureUserProfile(user.id, {
  email: userEmail,
  fullName: getBestFullName(userMetadata),
});
    });

    console.log("[Auth Callback] Profile ensured", {
      userId: user.id,
    });

    // ==================== Stage 4: Resolve roles ====================
    const roleContext = await runStage("resolving_roles", async () => {
     return resolveAuthRoleContext({
  userId: user.id,
  email: userEmail,
  metadataRole: isAppRole(userMetadata.app_role)
    ? userMetadata.app_role
    : null,
  metadataRoles: rolesFromUserMetadata(userMetadata),
});
    });

    console.log("[Auth Callback] Roles resolved", {
      userId: user.id,
      availableRoles: roleContext.availableRoles,
      activeRole: roleContext.activeRole ?? null,
      profileRole: roleContext.profileAppRole ?? null,
    });

    // ==================== Stage 5: Determine target role ====================
    const targetRole = await runStage("determining_role", async () => {
      const requestedRole: AppRole | null = isAppRole(config.requestedRole)
        ? config.requestedRole
        : null;

      const activeRole: AppRole | null = isAppRole(roleContext.activeRole)
        ? roleContext.activeRole
        : null;

      const preferredRole: AppRole | null = requestedRole ?? activeRole;

      return determineTargetRole(roleContext, preferredRole);
    });

    if (!targetRole) {
      logStage("no_target_role", "Could not determine target role");
      return {
        ok: false,
        stage: "determining_role",
        error: "Could not determine your role. Please try again or contact support.",
      };
    }

    console.log("[Auth Callback] Target role determined", {
      userId: user.id,
      targetRole,
    });

    // ==================== Stage 6: Claim/bootstrap role if needed ====================
    await runStage("claiming_role", async () => {
      const hasTargetRole = roleContext.availableRoles.includes(targetRole);

      if (hasTargetRole) {
        console.log("[Auth Callback] Role already available", {
          userId: user.id,
          targetRole,
        });
        return;
      }

     await claimInitialRole(user.id, targetRole, {
  email: userEmail,
  fullName: getBestFullName(userMetadata),
  userMetadata,
});

      console.log("[Auth Callback] Initial role claimed", {
        userId: user.id,
        targetRole,
      });
    });

    // ==================== Stage 7: Set active role cookie ====================
    await runStage("setting_cookie", async () => {
      cookieStore.set(ROLE_COOKIE_KEY, targetRole, {
        path: "/",
        maxAge: 60 * 60 * 24 * 365,
        sameSite: "lax",
        secure: process.env.NODE_ENV === "production",
        httpOnly: false,
      });
    });

    console.log("[Auth Callback] Active role cookie set", {
      userId: user.id,
      targetRole,
    });

    // ==================== Stage 8: Determine redirect ====================
    const redirectUrl = await runStage("determining_redirect", async () => {
      return getRoleHomePath(targetRole);
    });

    console.log("[Auth Callback] SUCCESS", {
      userId: user.id,
      targetRole,
      redirectUrl,
      totalMs: Date.now() - startTime,
      stages,
    });

    return {
      ok: true,
      redirectUrl,
      fallbackUrl: redirectUrl,
    };
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : "Unknown error during auth callback";

    console.error("[Auth Callback] FAILED", {
      error: message,
      stage: stages[stages.length - 1] ?? "unknown",
      stages,
      totalMs: Date.now() - startTime,
    });

    return {
      ok: false,
      error: message,
      stage: stages[stages.length - 1] ?? "unknown",
    };
  }
}

/**
 * Ensures a profile row exists for the authenticated user.
 * Safe to call multiple times.
 */
async function ensureUserProfile(userId: string, info: ProfileInfo): Promise<void> {
  const admin = createAdminClient();
  const now = new Date().toISOString();

  const { data: existing, error: selectError } = await admin
    .from("profiles")
    .select("id")
    .eq("id", userId)
    .maybeSingle();

  if (selectError) {
    throw new Error(`Failed to check existing profile: ${selectError.message}`);
  }

  if (existing?.id) {
    return;
  }

  const { error: insertError } = await admin.from("profiles").insert({
    id: userId,
    email: info.email ?? "",
    full_name: info.fullName ?? "",
    updated_at: now,
  });

  if (insertError) {
    if ((insertError as { code?: string }).code === "23505") {
      console.log("[ensureUserProfile] Profile already created by another request");
      return;
    }

    throw new Error(`Failed to create profile: ${insertError.message}`);
  }
}

/**
 * Claims/bootstrap the initial app role for a user that does not yet have one.
 * Safe to call multiple times.
 */
async function claimInitialRole(
  userId: string,
  role: AppRole,
  info: ClaimRoleInfo
): Promise<void> {
  const admin = createAdminClient();

  const metadata: Record<string, unknown> = {
    ...(info.userMetadata ?? {}),
    app_role: role,
    app_roles: Array.from(
      new Set([
        ...rolesFromUserMetadata(info.userMetadata),
        normalizeRole(info.userMetadata?.app_role),
        role,
      ].filter(Boolean))
    ),
  };

  if (info.fullName) {
    metadata.full_name = info.fullName;
  }

  const { error } = await admin.auth.admin.updateUserById(userId, {
    user_metadata: metadata,
  });

  if (error) {
    throw new Error(`Failed to update user metadata: ${error.message}`);
  }
}

/**
 * Determines the role that should become active after OAuth.
 *
 * Priority:
 * 1. Preferred role when requested, so it can be claimed during onboarding
 * 2. First available role
 * 3. Bootstrap teacher for first-time users with no roles
 */
function determineTargetRole(
  context: AuthRoleContext,
  preferredRole: AppRole | null
): AppRole | null {
  if (preferredRole) {
    return preferredRole;
  }

  if (context.availableRoles.length > 0) {
    return context.availableRoles[0];
  }

  return "teacher";
}

/**
 * Returns the best available user display name from metadata.
 */
function getBestFullName(metadata: UserMetadata): string | null {
  if (typeof metadata.full_name === "string" && metadata.full_name.trim()) {
    return metadata.full_name.trim();
  }

  if (typeof metadata.name === "string" && metadata.name.trim()) {
    return metadata.name.trim();
  }

  return null;
}

/**
 * Makes sure metadata is always a plain object.
 */
function normalizeUserMetadata(value: unknown): UserMetadata {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as UserMetadata;
  }

  return {};
}

/**
 * Wrap a promise with a timeout.
 */
async function withTimeout<T>(
  promise: Promise<T>,
  ms: number,
  timeoutMessage: string
): Promise<T> {
  let timeoutHandle: ReturnType<typeof setTimeout> | undefined;

  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutHandle = setTimeout(() => {
      reject(new Error(timeoutMessage));
    }, ms);
  });

  try {
    return await Promise.race([promise, timeoutPromise]);
  } finally {
    if (timeoutHandle) {
      clearTimeout(timeoutHandle);
    }
  }
}

/**
 * Simple stage logger for easier debugging.
 */
function logStage(stage: string, message: string): void {
  console.log(`[Auth Callback] Stage: ${stage}`, message);
}
