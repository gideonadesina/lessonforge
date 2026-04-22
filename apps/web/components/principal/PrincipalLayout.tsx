"use client";

import { useEffect, useMemo, useState } from "react";
import { createBrowserSupabase } from "@/lib/supabase/browser";
import type { PrincipalDashboardPayload } from "@/lib/principal/types";
import PrincipalSidebar from "@/components/principal/PrincipalSidebar";
import PrincipalTopbar from "@/components/principal/PrincipalTopbar";

type PrincipalLayoutProps = {
  children: React.ReactNode;
  initialUserEmail: string;
  initialPrincipalName: string;
  initialSchoolName: string | null;
};

type DashboardApiResponse = {
  ok: boolean;
  onboardingRequired?: boolean;
  data?: PrincipalDashboardPayload;
  error?: string;
};

function getFallbackName(email: string) {
  return email.split("@")[0] || "Principal";
}

function computeNotificationCount(payload: PrincipalDashboardPayload) {
  const inactiveTeachers = payload.teachers.filter(
    (teacher) => teacher.status === "disabled" || teacher.status === "pending"
  ).length;
  const slotsRemaining = Math.max(payload.subscription.slotLimit - payload.overview.totalTeachers, 0);
  const lowActivity = payload.overview.totalTeachers > 0 && payload.overview.weeklyActivityCount < payload.overview.totalTeachers;
  const slotAlert = slotsRemaining <= 2 ? 1 : 0;
  const activityAlert = lowActivity ? 1 : 0;
  return Math.min(99, inactiveTeachers + slotAlert + activityAlert);
}

export default function PrincipalLayout({
  children,
  initialUserEmail,
  initialPrincipalName,
  initialSchoolName,
}: PrincipalLayoutProps) {
  const supabase = useMemo(() => createBrowserSupabase(), []);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);

  const [principalName, setPrincipalName] = useState(
    initialPrincipalName || getFallbackName(initialUserEmail)
  );
  const [schoolName, setSchoolName] = useState<string | null>(initialSchoolName);
  const [email, setEmail] = useState<string | null>(initialUserEmail || null);
  const [notificationCount, setNotificationCount] = useState(0);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getUser();
      const user = data?.user;
      if (!user) return;

      setEmail(user.email ?? initialUserEmail);
      const meta = (user.user_metadata ?? {}) as { full_name?: string | null; name?: string | null };
      const displayName = meta.full_name || meta.name || user.email?.split("@")[0] || "Principal";
      setPrincipalName((current) => current || displayName);
    })();
  }, [initialUserEmail, supabase]);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;
      if (!token) return;

      try {
        const res = await fetch("/api/principal/dashboard", {
          headers: { Authorization: `Bearer ${token}` },
        });
        const json = (await res.json()) as DashboardApiResponse;
        if (!res.ok || !json.ok || json.onboardingRequired || !json.data) return;

        setSchoolName(json.data.school.name || initialSchoolName);
        if (json.data.school.principalName) {
          setPrincipalName(json.data.school.principalName);
        }
        setNotificationCount(computeNotificationCount(json.data));
      } catch {
        // keep shell resilient even when API is unavailable
      }
    })();
  }, [initialSchoolName, supabase]);

  return (
    <div className="min-h-screen bg-[var(--bg)] text-[var(--text-primary)]">
      <PrincipalSidebar
        mobileOpen={mobileOpen}
        setMobileOpen={setMobileOpen}
        collapsed={collapsed}
        setCollapsed={setCollapsed}
      />

      <div className={["transition-[padding] duration-300", collapsed ? "lg:pl-28" : "lg:pl-80"].join(" ")}>
  <div className="mx-auto w-full max-w-[1400px] px-4 pt-4 md:px-6">
          <PrincipalTopbar
            onOpenMenu={() => setMobileOpen(true)}
            principalName={principalName}
            schoolName={schoolName}
            email={email}
            notificationCount={notificationCount}
          />
        </div>
        <main className="mx-auto w-full max-w-[1400px] px-4 pb-12 pt-2 md:px-6">
  {children}
</main>
      </div>
    </div>
  );
}