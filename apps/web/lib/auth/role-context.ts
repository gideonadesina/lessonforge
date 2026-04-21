import { createClient } from "@supabase/supabase-js";

import type { AppRole } from "@/lib/auth/roles";
import { normalizeRole } from "@/lib/auth/roles";
import { isMissingTableOrColumnError, isPrincipalRole, normalizeTeacherStatus } from "@/lib/principal/utils";
import { createAdminClient } from "@/lib/supabase/admin";

type MembershipRow = {
  role: string | null;
  status?: string | null;
  school_id?: string | null;
  created_at?: string | null;
};

type SchoolOwnerRow = {
  id: string;
};

type ProfileRoleRow = {
  role?: string | null;
  app_role?: string | null;
};

export type AuthRoleContext = {
  activeRole: string | null;
  userId: string;
  email: string | null;
  availableRoles: AppRole[];
  hasTeacherAccess: boolean;
  hasPrincipalAccess: boolean;
  principalSchoolId: string | null;
  hasMembership: boolean;
  profileExists: boolean;
  isRegistered: boolean;
  profileRole: AppRole | null;
  profileAppRole: AppRole | null;
};

function createUserClientWithToken(token: string) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

  if (!url || !anon) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY");
  }

  return createClient(url, anon, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
    global: {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    },
  });
}

async function readMembershipRows(userId: string) {
  const admin = createAdminClient();
  const membershipRes = await admin
    .from("school_members")
    .select("role, status, school_id, created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (membershipRes.error && !isMissingTableOrColumnError(membershipRes.error)) {
    throw new Error(membershipRes.error.message);
  }

  return (membershipRes.data ?? []) as MembershipRow[];
}

async function readOwnedSchool(userId: string) {
  const admin = createAdminClient();
  const schoolRes = await admin
    .from("schools")
    .select("id")
    .eq("created_by", userId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (schoolRes.error && !isMissingTableOrColumnError(schoolRes.error)) {
    throw new Error(schoolRes.error.message);
  }

  return (schoolRes.data as SchoolOwnerRow | null) ?? null;
}

async function readProfileRoleClaims(userId: string): Promise<{
  profileExists: boolean;
  profileRole: AppRole | null;
  profileAppRole: AppRole | null;
}> {
  const admin = createAdminClient();
  const withBothColumns = await admin
    .from("profiles")
    .select("role, app_role")
    .eq("id", userId)
    .maybeSingle();

  if (!withBothColumns.error) {
    const row = (withBothColumns.data as ProfileRoleRow | null) ?? null;
    return {
      profileExists: Boolean(row),
      profileRole: normalizeRole(row?.role ?? null),
      profileAppRole: normalizeRole(row?.app_role ?? null),
    };
  }

  if (!isMissingTableOrColumnError(withBothColumns.error)) {
    throw new Error(withBothColumns.error.message);
  }

  const withRoleOnly = await admin
    .from("profiles")
    .select("role")
    .eq("id", userId)
    .maybeSingle();

  if (!withRoleOnly.error) {
    const row = (withRoleOnly.data as ProfileRoleRow | null) ?? null;
    return {
      profileExists: Boolean(row),
      profileRole: normalizeRole(row?.role ?? null),
      profileAppRole: null,
    };
  }

  if (!isMissingTableOrColumnError(withRoleOnly.error)) {
    throw new Error(withRoleOnly.error.message);
  }

  const withAppRoleOnly = await admin
    .from("profiles")
    .select("app_role")
    .eq("id", userId)
    .maybeSingle();

  if (withAppRoleOnly.error && !isMissingTableOrColumnError(withAppRoleOnly.error)) {
    throw new Error(withAppRoleOnly.error.message);
  }

  const appRoleRow = (withAppRoleOnly.data as ProfileRoleRow | null) ?? null;
  return {
    profileExists: Boolean(appRoleRow),
    profileRole: null,
    profileAppRole: normalizeRole(appRoleRow?.app_role ?? null),
  };
}

export async function resolveAuthRoleContext(input: {
  userId: string;
  email: string | null;
  metadataRole: AppRole | null;
}): Promise<AuthRoleContext> {
  const [memberships, ownedSchool, profileClaims] = await Promise.all([
    readMembershipRows(input.userId),
    readOwnedSchool(input.userId),
    readProfileRoleClaims(input.userId),
  ]);

  const hasMembership = memberships.length > 0;
  const principalMembership = memberships.find((row) => isPrincipalRole(row.role)) ?? null;
  const hasPrincipalMembership = Boolean(principalMembership);

  const hasTeacherMembership = memberships.some((row) => {
    if (isPrincipalRole(row.role)) return false;
    const teacherStatus = normalizeTeacherStatus({
      role: row.role ?? null,
      status: row.status ?? null,
    });
    return teacherStatus !== "removed" && teacherStatus !== "disabled";
  });

  const principalRoleClaim =
    profileClaims.profileRole === "principal" || profileClaims.profileAppRole === "principal";
  const teacherRoleClaim =
    profileClaims.profileRole === "teacher" ||
    profileClaims.profileAppRole === "teacher" ||
    input.metadataRole === "teacher";

  const hasPrincipalAccess = hasPrincipalMembership || Boolean(ownedSchool?.id) || principalRoleClaim;
  const hasTeacherAccess = hasTeacherMembership || teacherRoleClaim;

  const availableRoles: AppRole[] = [];
  if (hasTeacherAccess) availableRoles.push("teacher");
  if (hasPrincipalAccess) availableRoles.push("principal");

  const isRegistered =
    profileClaims.profileExists ||
    hasMembership ||
    profileClaims.profileRole != null ||
    profileClaims.profileAppRole != null ||
    input.metadataRole != null;

  return {
    activeRole: input.metadataRole ?? availableRoles[0] ?? null,
    userId: input.userId,
    email: input.email,
    availableRoles,
    hasTeacherAccess,
    hasPrincipalAccess,
    principalSchoolId: principalMembership?.school_id ?? ownedSchool?.id ?? null,
    hasMembership,
    profileExists: profileClaims.profileExists,
    isRegistered,
    profileRole: profileClaims.profileRole,
    profileAppRole: profileClaims.profileAppRole,
  };
}

export async function resolveAuthRoleContextFromToken(token: string) {
  if (!token) {
    return {
      ok: false as const,
      status: 401,
      error: "Unauthorized",
      context: null,
    };
  }

  const userClient = createUserClientWithToken(token);
  const {
    data: { user },
    error: userErr,
  } = await userClient.auth.getUser();

  if (userErr || !user) {
    return {
      ok: false as const,
      status: 401,
      error: "Unauthorized",
      context: null,
    };
  }

  const metadataRole = normalizeRole((user.user_metadata as Record<string, unknown> | null)?.app_role ?? null);
  const context = await resolveAuthRoleContext({
    userId: user.id,
    email: user.email ?? null,
    metadataRole,
  });

  return {
    ok: true as const,
    status: 200,
    error: null,
    context,
    user,
  };
}
