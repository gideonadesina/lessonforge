import { ReactNode } from "react";
import { redirect } from "next/navigation";
import { createServerSupabase } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isPrincipalRole, isMissingTableOrColumnError } from "@/lib/principal/utils";

export const dynamic = "force-dynamic";

export default async function PrincipalLayout({ children }: { children: ReactNode }) {
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
    .select("role")
    .eq("user_id", user.id);

  if (membershipRes.error && !isMissingTableOrColumnError(membershipRes.error)) {
    throw new Error(membershipRes.error.message);
  }

  const memberships = (membershipRes.data ?? []) as Array<{ role: string | null }>;
  const hasAnyMembership = memberships.length > 0;
  const hasPrincipalMembership = memberships.some((m) => isPrincipalRole(m.role));

  const schoolRes = await admin
    .from("schools")
    .select("id")
    .eq("created_by", user.id)
    .limit(1)
    .maybeSingle();

  if (schoolRes.error && !isMissingTableOrColumnError(schoolRes.error)) {
    throw new Error(schoolRes.error.message);
  }

  const createdSchool = Boolean(schoolRes.data?.id);

  // Allow:
  // 1. principals/admins/owners/headteachers
  // 2. users who already created a school
  // 3. users with no school yet, so they can start onboarding
  const shouldBlockPrincipalArea = hasAnyMembership && !hasPrincipalMembership && !createdSchool;

  if (shouldBlockPrincipalArea) {
    redirect("/dashboard");
  }

  return <>{children}</>;
}