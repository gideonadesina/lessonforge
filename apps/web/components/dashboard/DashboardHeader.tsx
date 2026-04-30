"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { createBrowserSupabase } from "@/lib/supabase/browser";
import { useProfile } from "@/lib/useProfile";
import type { AppRole } from "@/lib/auth/roles";

type ProfileMeta = {
  full_name?: string | null;
  name?: string | null;
};

type SchoolMeResponse = {
  ok?: boolean;
  data?: {
    school?: {
      id?: string;
      name?: string | null;
      shared_credits?: number | null;
      credits_remaining?: number | null;
      remaining_credits?: number | null;
    } | null;
  };
};

type RolesResponse = {
  ok?: boolean;
  data?: {
    availableRoles?: AppRole[];
  };
};

export default function DashboardHeader() {
  const supabase = useMemo(() => createBrowserSupabase(), []);
  const { creditsRemaining, planLabel } = useProfile();

  const [name, setName] = useState("Teacher");
  const [hasPrincipalRole, setHasPrincipalRole] = useState(false);
  const [schoolName, setSchoolName] = useState<string | null>(null);
  const [schoolCredits, setSchoolCredits] = useState<number | null>(null);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getUser();
      const user = data?.user;
      if (!user) return;

      const meta = (user.user_metadata ?? {}) as ProfileMeta;
      const displayName =
        meta.full_name ||
        meta.name ||
        user.email?.split("@")[0] ||
        "Teacher";
      setName(displayName);

      const {
        data: { session },
      } = await supabase.auth.getSession();
      const token = session?.access_token ?? "";

      const appRole = user.user_metadata?.app_role;
      if (appRole === "principal") {
        setHasPrincipalRole(true);
      } else {
        const { data: profile } = await supabase
          .from("profiles")
          .select("app_role")
          .eq("id", user.id)
          .single();
        setHasPrincipalRole(profile?.app_role === "principal");
      }

      if (!token) return;

      const [schoolRes, rolesRes] = await Promise.all([
        fetch("/api/schools/me", { headers: { Authorization: `Bearer ${token}` } }),
        fetch("/api/auth/roles", { headers: { Authorization: `Bearer ${token}` } }),
      ]);

      if (schoolRes.ok) {
        const json = (await schoolRes.json()) as SchoolMeResponse;
        const school = json.data?.school ?? null;
        if (json.ok && school?.id) {
          const remaining =
            typeof school.remaining_credits === "number"
              ? school.remaining_credits
              : typeof school.credits_remaining === "number"
                ? school.credits_remaining
                : typeof school.shared_credits === "number"
                  ? school.shared_credits
                  : null;
          setSchoolName(school.name ?? "Your School");
          setSchoolCredits(typeof remaining === "number" ? Math.max(0, remaining) : null);
        }
      }

      if (rolesRes.ok) {
        const json = (await rolesRes.json()) as RolesResponse;
        setHasPrincipalRole(Boolean(json.data?.availableRoles?.includes("principal")));
      }
    })();
  }, [supabase]);

  function getGreeting() {
    const hour = new Date().getHours();
    if (hour < 12) return "Good morning";
    if (hour < 17) return "Good afternoon";
    return "Good evening";
  }

  const lessonsRemaining = Math.floor(creditsRemaining / 4);
  const schoolLessonsRemaining =
    typeof schoolCredits === "number" ? Math.floor(schoolCredits / 4) : null;
  const isLowCredits = creditsRemaining <= 10;
  const hasSchoolWorkspace = Boolean(schoolName);

  return (
    <section className="rounded-[24px] border border-[var(--border)] bg-[var(--card)] px-6 py-6 shadow-sm">
      <div className="flex flex-col gap-6 xl:flex-row xl:gap-8">
        <div className="min-w-0 flex-1">
          <div className="text-sm font-medium text-[var(--text-secondary)]">
            {getGreeting()}
          </div>

          <h1 className="mt-1 text-2xl font-extrabold tracking-tight text-[var(--text-primary)] sm:text-3xl">
            {name}
          </h1>

          <p className="mt-2 text-sm leading-relaxed text-[var(--text-secondary)]">
            Welcome to your teaching workspace. Plan faster, generate stronger
            lessons, and stay organized.
          </p>

          <div className="mt-4 rounded-2xl border border-[var(--border)] bg-[var(--card-alt)] p-4">
            {hasSchoolWorkspace ? (
              <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                <div>
                  <div className="text-xs font-semibold uppercase tracking-wide text-emerald-700 dark:text-emerald-300">
                    Workspace
                  </div>
                  <div className="mt-1 text-lg font-extrabold text-[var(--text-primary)]">
                    {schoolName}
                  </div>
                  <div className="mt-2 grid gap-1 text-xs text-[var(--text-secondary)]">
                    <span>Role: Teacher</span>
                    <span>Credit source: Using school credits</span>
                    <span>Personal plan: {planLabel}</span>
                  </div>
                </div>

                <div className="text-left md:text-right">
                  <div className="text-xs font-semibold uppercase tracking-wide text-[var(--text-secondary)]">
                    School Credits
                  </div>
                  <div className="mt-1 text-2xl font-extrabold text-emerald-700 dark:text-emerald-300">
                    {schoolCredits ?? "-"}
                  </div>
                  <div className="mt-1 text-xs text-[var(--text-secondary)]">
                    {schoolLessonsRemaining == null
                      ? "Estimated lesson packs unavailable"
                      : `~${schoolLessonsRemaining} lesson packs available`}
                  </div>
                </div>
              </div>
            ) : (
              <>
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="text-xs font-semibold uppercase tracking-wide text-[var(--text-secondary)]">
                      Plan
                    </div>
                    <div className="mt-1 text-lg font-extrabold text-[var(--text-primary)]">
                      {planLabel}
                    </div>
                    <Link
                      href="/settings"
                      className="mt-2 inline-flex text-xs font-semibold text-violet-600 hover:text-violet-700 dark:text-violet-400 dark:hover:text-violet-300"
                    >
                      See plans
                    </Link>
                  </div>

                  <div className="text-right">
                    <div className="flex items-baseline justify-end gap-1">
                      <div className="text-lg font-extrabold text-[var(--text-primary)]">
                        {creditsRemaining}
                      </div>
                      <div className="text-xs text-[var(--text-secondary)]">
                        credits
                      </div>
                    </div>

                    <div className="mt-2 h-1.5 w-32 overflow-hidden rounded-full bg-[var(--border)]">
                      <div
                        className={`h-full transition-all ${
                          isLowCredits ? "bg-amber-500" : "bg-violet-600"
                        }`}
                        style={{
                          width: `${Math.min((creditsRemaining / 100) * 100, 100)}%`,
                        }}
                      />
                    </div>

                    <div className="mt-2 text-xs text-[var(--text-secondary)]">
                      ~{lessonsRemaining} lesson packs
                    </div>

                    {isLowCredits ? (
                      <div className="mt-2 inline-flex rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-[10px] font-semibold text-amber-700 dark:border-amber-900/50 dark:bg-amber-900/20 dark:text-amber-400">
                        Running low
                      </div>
                    ) : null}
                  </div>
                </div>

                <Link
                  href="/settings?tab=billing"
                  className="mt-3 inline-flex text-xs font-semibold text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                >
                  Upgrade for unlimited credits
                </Link>
              </>
            )}
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-3">
            <Link
              href="/generate"
              className="inline-flex items-center justify-center rounded-2xl bg-violet-600 px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-violet-700 dark:bg-violet-600 dark:hover:bg-violet-700"
            >
              Generate Lesson
            </Link>

            <Link
              href="/library"
              className="inline-flex items-center justify-center rounded-2xl border border-[var(--border)] bg-[var(--card)] px-5 py-3 text-sm font-semibold text-[var(--text-primary)] transition hover:bg-[var(--card-alt)]"
            >
              Open Library
            </Link>

            {hasPrincipalRole ? (
              <Link
                href="/principal"
                className="inline-flex items-center justify-center gap-2 rounded-2xl border border-violet-200 bg-violet-50 px-5 py-3 text-sm font-semibold text-violet-700 transition hover:bg-violet-100 dark:border-violet-900/50 dark:bg-violet-900/20 dark:text-violet-400"
              >
                Switch to Principal View
              </Link>
            ) : null}
          </div>
        </div>
      </div>
    </section>
  );
}
