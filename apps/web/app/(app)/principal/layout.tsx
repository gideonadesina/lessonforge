import { ReactNode } from "react";
import { redirect } from "next/navigation";
import { createServerSupabase } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isPrincipalRole, isMissingTableOrColumnError } from "@/lib/principal/utils";
import PrincipalLayout from "@/components/principal/PrincipalLayout";

export const dynamic = "force-dynamic";

export default async function PrincipalRouteLayout({ children }: { children: ReactNode }) {
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
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

  const selectedPrincipalRole =
    String((user.user_metadata as { app_role?: unknown } | null)?.app_role ?? "").toLowerCase() === "principal";


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
  const shouldBlockPrincipalArea = hasAnyMembership && !hasPrincipalMembership && !createdSchool && !selectedPrincipalRole;
  if (shouldBlockPrincipalArea) {
    redirect("/dashboard");
  }

  const fallbackPrincipalName =
    ((user.user_metadata as { full_name?: string; name?: string } | null)?.full_name as string | undefined) ||
    ((user.user_metadata as { full_name?: string; name?: string } | null)?.name as string | undefined) ||
    user.email?.split("@")[0] ||
    "Principal";

  const effectiveSchool = createdSchoolData ?? membershipSchool;
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
