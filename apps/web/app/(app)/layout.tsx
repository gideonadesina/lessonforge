import type { ReactNode } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createServerClient } from "@supabase/ssr";

import AppFrame from "@/components/layout/AppFrame";
import ForgeGuideLauncher from "@/components/ForgeGuideLauncher";
import { resolveAuthRoleContext } from "@/lib/auth/role-context";
import {
  ROLE_COOKIE_KEY,
  normalizeRole,
  resolvePreferredRole,
  rolesFromUserMetadata,
} from "@/lib/auth/roles";
import "../globals.css";

async function createServerSupabase() {
  const cookieStore = await Promise.resolve(cookies());

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

  if (!url || !anon) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY"
    );
  }

  return createServerClient(url, anon, {
    cookies: {
      getAll() {
        return cookieStore.getAll?.() ?? [];
      },
      setAll() {
        // no-op: cookies cannot be written from a layout/server component render
      },
    },
  });
}

export default async function AppLayout({
  children,
}: {
  children: ReactNode;
}) {
  const cookieStore = await Promise.resolve(cookies());
  const supabase = await createServerSupabase();

  // Read session first so fresh OAuth cookies are picked up before getUser
  const { data: sessionData } = await supabase.auth.getSession();
  const { data, error } = sessionData?.session
    ? await supabase.auth.getUser()
    : { data: { user: null }, error: new Error("No session") };

  const user = data?.user;
  const userMeta =
    (user?.user_metadata as {
      app_role?: string;
      full_name?: string;
      name?: string;
    } | null) ?? null;

  if (error || !user) {
    redirect("/login");
  }

  const metadataRole = normalizeRole(userMeta?.app_role ?? null);
  const roleContext = await resolveAuthRoleContext({
    userId: user.id,
    email: user.email ?? null,
    metadataRole,
    metadataRoles: rolesFromUserMetadata(user.user_metadata),
  });

  if (!roleContext.availableRoles.length) {
    redirect("/select-role");
  }

  const cookieRole = normalizeRole(
    cookieStore.get(ROLE_COOKIE_KEY)?.value ?? null
  );
  const activeRole = resolvePreferredRole(
    roleContext.availableRoles,
    cookieRole,
    { allowNullWhenMultiple: true }
  );

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

  // Navigation between /dashboard and /principal is handled by
  // role switcher buttons in DashboardHeader and PrincipalPage.
  // No server-side redirect needed — cookie handles routing on login.

  const userEmail = user.email ?? "";
  const userName =
    userMeta?.full_name ||
    userMeta?.name ||
    userEmail.split("@")[0] ||
    "User";

  return (
    <AppFrame userEmail={userEmail}>
      {children}
      <ForgeGuideLauncher
        teacherName={String(userName)}
        userEmail={userEmail}
      />
    </AppFrame>
  );
}
