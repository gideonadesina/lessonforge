import { ReactNode } from "react";
import { redirect } from "next/navigation";
import { createServerSupabase } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { resolveAuthRoleContext } from "@/lib/auth/role-context";
import {
  ROLE_COOKIE_KEY,
  getRoleHomePath,
  normalizeRole,
  resolvePreferredRole,
  rolesFromUserMetadata,
} from "@/lib/auth/roles";
import { isPrincipalRole, isMissingTableOrColumnError } from "@/lib/principal/utils";
import { repairPrincipalDerivedSchoolName } from "@/lib/principal/server";
import PrincipalLayout from "@/components/principal/PrincipalLayout";
import { cookies } from "next/headers";

export const dynamic = "force-dynamic";

export default async function PrincipalRouteLayout({ children }: { children: ReactNode }) {
  const cookieStore = await Promise.resolve(cookies());
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const metadataRole = normalizeRole(
    (user.user_metadata as { app_role?: unknown } | null)?.app_role ?? null
  );
  const roleContext = await resolveAuthRoleContext({
    userId: user.id,
    email: user.email ?? null,
    metadataRole,
    metadataRoles: rolesFromUserMetadata(user.user_metadata),
  });
  if (!roleContext.availableRoles.length) {
    redirect("/select-role");
  }

  const cookieRole = normalizeRole(cookieStore.get(ROLE_COOKIE_KEY)?.value ?? null);
  const activeRole = resolvePreferredRole(roleContext.availableRoles, cookieRole, {
    allowNullWhenMultiple: true,
  });
  if (roleContext.availableRoles.length > 1 && !activeRole) {
    redirect("/select-role");
  }

  const resolvedRole =
    activeRole ??
    resolvePreferredRole(roleContext.availableRoles, metadataRole, {
      allowNullWhenMultiple: false,
    });

  if (!resolvedRole) {
    redirect("/select-role");
  }

  if (resolvedRole !== "principal") {
    redirect(getRoleHomePath("teacher"));
  }

  const admin = createAdminClient();

  const membershipRes = await admin
    .from("school_members")
    .select("role, school_id")
    .eq("user_id", user.id);

  if (membershipRes.error && !isMissingTableOrColumnError(membershipRes.error)) {
    throw new Error(membershipRes.error.message);
  }

   const memberships = (membershipRes.data ?? []) as Array<{ role: string | null; school_id?: string | null }>;
  const hasAnyMembership = memberships.length > 0;
  const hasPrincipalMembership = memberships.some((m) => isPrincipalRole(m.role));
   const principalMembershipSchoolId =
    memberships.find((m) => isPrincipalRole(m.role) && m.school_id)?.school_id ?? null;
     let membershipSchool: { id: string; name: string | null; principal_name: string | null } | null = null;
  if (principalMembershipSchoolId) {
    const membershipSchoolRes = await admin
      .from("schools")
      .select("id, name, principal_name")
      .eq("id", principalMembershipSchoolId)
      .maybeSingle();

    if (membershipSchoolRes.error && !isMissingTableOrColumnError(membershipSchoolRes.error)) {
      throw new Error(membershipSchoolRes.error.message);
    }
    membershipSchool = (membershipSchoolRes.data as { id: string; name: string | null; principal_name: string | null } | null) ?? null;
  }

  const schoolRes = await admin
    .from("schools")
    
    .select("id, name, principal_name")
    .eq("created_by", user.id)
    .limit(1)
    .maybeSingle();

  if (schoolRes.error && !isMissingTableOrColumnError(schoolRes.error)) {
    throw new Error(schoolRes.error.message);
  }

 const createdSchoolData = (schoolRes.data as { id: string; name: string | null; principal_name: string | null } | null) ?? null;
  const createdSchool = Boolean(createdSchoolData?.id);
  // Allow:
  // 1. principals/admins/owners/headteachers
  // 2. users who already created a school
  // 3. users with no school yet, so they can start onboarding
  const shouldBlockPrincipalArea =
    hasAnyMembership && !hasPrincipalMembership && !createdSchool && !roleContext.hasPrincipalAccess;
  if (shouldBlockPrincipalArea) {
    redirect("/dashboard");
  }

  const fallbackPrincipalName =
    ((user.user_metadata as { full_name?: string; name?: string } | null)?.full_name as string | undefined) ||
    ((user.user_metadata as { full_name?: string; name?: string } | null)?.name as string | undefined) ||
    user.email?.split("@")[0] ||
    "Principal";

  let effectiveSchool: { id: string; name: string | null; principal_name: string | null } | null = createdSchoolData ?? membershipSchool;
  if (effectiveSchool) {
    const repairedSchool = await repairPrincipalDerivedSchoolName({
      school: {
        id: effectiveSchool.id,
        name: effectiveSchool.name,
        code: null,
        created_at: null,
        created_by: user.id,
        principal_name: effectiveSchool.principal_name,
      },
      principalId: user.id,
    });
    effectiveSchool = {
      id: repairedSchool.id,
      name: repairedSchool.name,
      principal_name: repairedSchool.principal_name ?? null,
    };
  }
  const initialPrincipalName = effectiveSchool?.principal_name || fallbackPrincipalName;
  const initialSchoolName = effectiveSchool?.name ?? null;

  return (
    <PrincipalLayout
      initialUserEmail={user.email ?? ""}
      initialPrincipalName={initialPrincipalName}
      initialSchoolName={initialSchoolName}
    >
      {children}
    </PrincipalLayout>
  );
}
