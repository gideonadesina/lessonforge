import { createClient } from "@supabase/supabase-js";
import { normalizeRole } from "@/lib/auth/roles";
import { resolveAuthRoleContext } from "@/lib/auth/role-context";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  isPrincipalRole,
  isMissingTableOrColumnError,
} from "@/lib/principal/utils";

export type PrincipalContext = {
  ok: boolean;
  error?: string;
  status?: number;
  user?: {
    id: string;
    email: string | null;
  };
  school?: {
    id: string;
    name: string | null;
    code: string | null;
    created_at: string | null;
    created_by: string | null;
    principal_name?: string | null;
  } | null;
  membershipRole?: string | null;
  appRole?: string | null;
  hasPrincipalAppRole?: boolean;
  isPrincipal?: boolean;
  isTeacherOnly?: boolean;
};

type SchoolRecord = {
  id: string;
  name: string | null;
  code: string | null;
  created_at: string | null;
  created_by: string | null;
  principal_name?: string | null;
};

type MembershipRow = {
  school_id: string;
  role: string | null;
};

function getUserClientWithToken(token: string) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

  if (!url || !anon) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY"
    );
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

export function getBearerTokenFromHeaders(headers: Headers) {
  const auth = headers.get("authorization") ?? "";
  return auth.startsWith("Bearer ") ? auth.slice(7) : "";
}

export async function resolvePrincipalContext(
  token: string
): Promise<PrincipalContext> {
  if (!token) {
    return { ok: false, error: "Unauthorized", status: 401 };
  }

  const userClient = getUserClientWithToken(token);
  const admin = createAdminClient();

  const { data: authData, error: authErr } = await userClient.auth.getUser();
  const user = authData?.user;

  if (authErr || !user) {
    return { ok: false, error: "Unauthorized", status: 401 };
  }

  const appRole = normalizeRole(
    (user.user_metadata as Record<string, unknown> | null)?.app_role
  );
  const roleContext = await resolveAuthRoleContext({
    userId: user.id,
    email: user.email ?? null,
    metadataRole: appRole,
  });
  const hasPrincipalAppRole = roleContext.hasPrincipalAccess;

  const memRes = await admin
    .from("school_members")
    .select("school_id, role")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  if (memRes.error && !isMissingTableOrColumnError(memRes.error)) {
    return { ok: false, error: memRes.error.message, status: 500 };
  }

  const membershipRows = (memRes.data ?? []) as MembershipRow[];
  const principalMembership =
    membershipRows.find((m) => isPrincipalRole(m.role)) ?? null;
  const latestMembership = membershipRows[0] ?? null;
  const teacherMembership =
    membershipRows.find((m) => !isPrincipalRole(m.role)) ?? null;

  let school: SchoolRecord | null = null;

  if (principalMembership?.school_id) {
    const schoolRes = await admin
      .from("schools")
      .select("id, name, code, created_at, created_by, principal_name")
      .eq("id", principalMembership.school_id)
      .maybeSingle();

    if (schoolRes.error && !isMissingTableOrColumnError(schoolRes.error)) {
      return { ok: false, error: schoolRes.error.message, status: 500 };
    }

    school = (schoolRes.data as SchoolRecord | null) ?? null;
  }

  if (!school) {
    const byCreatorRes = await admin
      .from("schools")
      .select("id, name, code, created_at, created_by, principal_name")
      .eq("created_by", user.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (byCreatorRes.error && !isMissingTableOrColumnError(byCreatorRes.error)) {
      return { ok: false, error: byCreatorRes.error.message, status: 500 };
    }

    school = (byCreatorRes.data as SchoolRecord | null) ?? null;
  }

  const isPrincipal = Boolean(
    principalMembership ||
      (school && school.created_by === user.id) ||
      roleContext.hasPrincipalAccess
  );

  const isTeacherOnly = Boolean(teacherMembership && !isPrincipal);

  return {
    ok: true,
    user: {
      id: user.id,
      email: user.email ?? null,
    },
    school,
    membershipRole: principalMembership?.role ?? latestMembership?.role ?? null,
    appRole,
    hasPrincipalAppRole,
    isPrincipal,
    isTeacherOnly,
  };
}

export async function resolveActiveSchoolCode(
  schoolId: string,
  fallbackCode: string | null
) {
  const admin = createAdminClient();

  const codeRes = await admin
    .from("school_codes")
    .select("code, is_active, created_at")
    .eq("school_id", schoolId)
    .eq("is_active", true)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (codeRes.error && !isMissingTableOrColumnError(codeRes.error)) {
    throw new Error(codeRes.error.message);
  }

  return codeRes.data?.code ?? fallbackCode ?? "";
}