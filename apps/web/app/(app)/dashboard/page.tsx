"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { createBrowserSupabase } from "@/lib/supabase/browser";
import { useProfile } from "@/lib/useProfile";
import { useToast } from "@/components/ui/ToastProvider";
import DashboardHeader from "@/components/dashboard/DashboardHeader";
import ForgeGuideStrip from "@/components/dashboard/ForgeGuideStrip";
import QuickActionsGrid from "@/components/dashboard/QuickActionsGrid";
import RecentActivity from "@/components/dashboard/RecentActivity";
import WeeklyInsight from "@/components/dashboard/WeeklyInsight";
import { listSchemeOfWork } from "@/lib/planning/scheme";
import { listAcademicEvents } from "@/lib/planning/academicCalendar";
import SchoolCodeInput from "@/components/SchoolCodeInput";
import type {
  AcademicCalendarRow,
  SchemeOfWorkRow,
} from "@/lib/planning/types";
import {
  formatEventDate,
  formatEventType,
  getWeekNumber,
  todayIsoDate,
} from "@/lib/planning/utils";
import LessonForgeOnboardingCard from "@/components/onboarding/LessonForgeOnboardingCard";
import LessonForgeWelcomeCard from "@/components/onboarding/LessonForgeWelcomeCard";
import AuthNotificationBanner from "@/components/auth/AuthNotificationBanner";

type LessonRow = {
  id: string;
  subject: string | null;
  topic: string | null;
  grade: string | null;
  curriculum: string | null;
  created_at: string;
};

type SchoolMembershipApiResponse = {
  ok: boolean;
  data?: {
    school: { id: string; name: string | null } | null;
  };
};

function formatDate(iso: string) {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "" : d.toLocaleString();
}

function relativeTime(iso: string) {
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return "";
  const diff = Date.now() - t;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

function getErrorMessage(error: unknown) {
  if (error instanceof Error) return error.message;
  return String(error);
}

export default function DashboardPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const supabase = useMemo(() => createBrowserSupabase(), []);
  const { showToast } = useToast();

  const { profile, creditsRemaining, planLabel } = useProfile();

  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [lessons, setLessons] = useState<LessonRow[]>([]);
  const [worksheetsCount, setWorksheetsCount] = useState(0);
  const [schemeRows, setSchemeRows] = useState<SchemeOfWorkRow[]>([]);
  const [academicEvents, setAcademicEvents] = useState<AcademicCalendarRow[]>(
    []
  );

  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState<string | null>(null);
  const [planningMsg, setPlanningMsg] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [schoolMembershipLoading, setSchoolMembershipLoading] = useState(true);
  const [hasSchoolMembership, setHasSchoolMembership] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [showWelcome, setShowWelcome] = useState(false);
  const [flowBusy, setFlowBusy] = useState(false);

  const teacherName = profile?.full_name || userEmail?.split("@")[0] || "Teacher";
  const firstName = String(teacherName).trim().split(" ")[0] || "Teacher";

  const loadSchoolMembership = useCallback(async () => {
    setSchoolMembershipLoading(true);
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      const token = session?.access_token ?? "";
      if (!token) {
        setHasSchoolMembership(false);
        return;
      }

      const res = await fetch("/api/schools/me", {
        headers: { Authorization: `Bearer ${token}` },
      });
      const json = (await res.json()) as SchoolMembershipApiResponse;
      if (!res.ok || !json.ok) {
        setHasSchoolMembership(false);
        return;
      }

      setHasSchoolMembership(Boolean(json.data?.school?.id));
    } catch {
      setHasSchoolMembership(false);
    } finally {
      setSchoolMembershipLoading(false);
    }
  }, [supabase]);

  useEffect(() => {
    if (searchParams.get("payment") === "success") {
      showToast("🎉 Credits added successfully!");

      const next = new URL(window.location.href);
      next.searchParams.delete("payment");
      window.history.replaceState({}, "", next.toString());
    }
  }, [searchParams, showToast]);

  useEffect(() => {
    if (!profile) return;

    if (!profile.onboarding_completed) {
      setShowOnboarding(true);
      setShowWelcome(false);
      return;
    }

    if (!profile.welcome_seen) {
      setShowOnboarding(false);
      setShowWelcome(true);
      return;
    }

    setShowOnboarding(false);
    setShowWelcome(false);
  }, [profile]);

  useEffect(() => {
    if (!showWelcome || !profile?.id) return;
    void markWelcomeSeen();
  }, [markWelcomeSeen, profile?.id, showWelcome]);

  useEffect(() => {
    const forgeWindow = window as Window & {
      __FORGE_CONTEXT__?: {
        page: string;
        teacherName: string;
        credits: number;
        plan: string;
        recentLessons: LessonRow[];
      };
    };
    forgeWindow.__FORGE_CONTEXT__ = {
      page: "dashboard",
      teacherName,
      credits: creditsRemaining,
      plan: planLabel,
      recentLessons: lessons.slice(0, 5),
    };
  }, [teacherName, creditsRemaining, planLabel, lessons]);

  useEffect(() => {
    void loadSchoolMembership();
  }, [loadSchoolMembership]);

  useEffect(() => {
    let alive = true;

    (async () => {
      setLoading(true);
      setMsg(null);
      setPlanningMsg(null);

      try {
        const {
          data: { user },
          error: authError,
        } = await supabase.auth.getUser();

        if (!alive) return;

        if (authError) {
          throw authError;
        }

        if (!user) {
          router.push("/login");
          return;
        }

        setUserEmail(user.email ?? null);

        const [lessonsRes, worksheetsRes, schemeRes, eventsRes] =
          await Promise.all([
            supabase
              .from("lessons")
              .select("id, subject, topic, grade, curriculum, created_at")
              .order("created_at", { ascending: false })
              .limit(200),
            supabase
              .from("worksheets")
              .select("id", { count: "exact", head: true }),
            listSchemeOfWork(supabase, user.id),
            listAcademicEvents(supabase, user.id),
          ]);

        if (!alive) return;

        if (lessonsRes.error) {
          setMsg(`Failed to load lessons: ${lessonsRes.error.message}`);
          setLessons([]);
        } else {
          setLessons((lessonsRes.data as LessonRow[]) ?? []);
        }

        if (worksheetsRes.error) {
          console.warn(
            "Failed to load worksheets count:",
            worksheetsRes.error.message
          );
          setWorksheetsCount(0);
        } else {
          setWorksheetsCount(worksheetsRes.count ?? 0);
        }

        if (schemeRes.error || eventsRes.error) {
          setPlanningMsg("Planning reminders are temporarily unavailable.");
          setSchemeRows([]);
          setAcademicEvents([]);
        } else {
          setPlanningMsg(null);
          setSchemeRows(schemeRes.data ?? []);
          setAcademicEvents(eventsRes.data ?? []);
        }
      } catch (error: unknown) {
        if (!alive) return;
        setMsg(`Dashboard error: ${getErrorMessage(error)}`);
        setLessons([]);
        setWorksheetsCount(0);
        setSchemeRows([]);
        setAcademicEvents([]);
      } finally {
        if (alive) setLoading(false);
      }
    })();

    return () => {
      alive = false;
    };
  }, [router, supabase]);

  async function deleteLesson(id: string) {
    const ok = window.confirm("Delete this item? This cannot be undone.");
    if (!ok) return;

    setDeletingId(id);
    setMsg(null);

    try {
      const { error } = await supabase.from("lessons").delete().eq("id", id);
      if (error) throw error;

      setLessons((prev) => prev.filter((lesson) => lesson.id !== id));
      setMsg("Deleted ✅");
    } catch (error: unknown) {
      setMsg(`Delete failed: ${getErrorMessage(error)}`);
    } finally {
      setDeletingId(null);
    }
  }

  const stats = useMemo(() => {
    const totalLessons = lessons.length;
    const savedToLibrary = lessons.length;
    const worksheetsCreated = worksheetsCount;

    const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
    const recent7d = lessons.filter((lesson) => {
      const t = new Date(lesson.created_at).getTime();
      return !Number.isNaN(t) && t >= weekAgo;
    }).length;

    return {
      totalLessons,
      savedToLibrary,
      worksheetsCreated,
      recent7d,
    };
  }, [lessons, worksheetsCount]);

  const recent = useMemo(() => lessons.slice(0, 8), [lessons]);

  const planningReminders = useMemo(() => {
    const currentWeek = getWeekNumber(new Date());

    const orderedScheme = [...schemeRows].sort((a, b) => {
      if (a.week_number !== b.week_number) {
        return a.week_number - b.week_number;
      }
      return (
        new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
      );
    });

    const thisWeekTopic =
      orderedScheme.find((row) => row.week_number === currentWeek) ?? null;

    let nextTopic: SchemeOfWorkRow | null = null;

    if (thisWeekTopic) {
      const thisWeekIndex = orderedScheme.findIndex(
        (row) => row.id === thisWeekTopic.id
      );

      nextTopic =
        orderedScheme
          .slice(thisWeekIndex + 1)
          .find((row) => row.status !== "completed") ?? null;
    }

    if (!nextTopic) {
      nextTopic =
        orderedScheme.find(
          (row) =>
            row.week_number > currentWeek &&
            row.status !== "completed" &&
            row.id !== thisWeekTopic?.id
        ) ??
        orderedScheme.find(
          (row) => row.status !== "completed" && row.id !== thisWeekTopic?.id
        ) ??
        null;
    }

    const orderedEvents = [...academicEvents].sort((a, b) =>
      a.event_date.localeCompare(b.event_date)
    );

    const upcomingEvent =
      orderedEvents.find((event) => event.event_date >= todayIsoDate()) ?? null;

    const pendingTopicsCount = orderedScheme.filter(
      (row) => row.status !== "completed"
    ).length;

    return {
      currentWeek,
      thisWeekTopic,
      nextTopic,
      upcomingEvent,
      pendingTopicsCount,
    };
  }, [academicEvents, schemeRows]);

  const isOutOfCredits = creditsRemaining <= 0;
  const isLowCredits = creditsRemaining > 0 && creditsRemaining <= 3;

  const markWelcomeSeen = useCallback(async () => {
    if (!profile?.id) return;
    setFlowBusy(true);
    try {
      const { error } = await supabase
        .from("profiles")
        .update({
          welcome_seen: true,
          updated_at: new Date().toISOString(),
        })
        .eq("id", profile.id);
      if (error) throw error;
    } catch (error: unknown) {
      setMsg(`Could not start workspace: ${getErrorMessage(error)}`);
    } finally {
      setFlowBusy(false);
    }
  }, [profile?.id, supabase]);

  useEffect(() => {
    if (showOnboarding || showWelcome) return;
    if (creditsRemaining > 0) return;
    router.replace("/pricing");
  }, [creditsRemaining, router, showOnboarding, showWelcome]);

  if (showOnboarding && profile) {
    return (
      <div className="min-h-screen bg-[#FAF9F6] px-4 py-8">
        <LessonForgeOnboardingCard
          profileId={profile.id}
          initialAnswers={profile.onboarding_answers}
          onCompleted={() => {
            setShowOnboarding(false);
            setShowWelcome(true);
            setWelcomeMarked(false);
          }}
        />
      </div>
    );
  }

  if (showWelcome && profile) {
    return (
      <div className="min-h-screen bg-[#FAF9F6] px-4 py-8">
        <LessonForgeWelcomeCard
          firstName={firstName}
          roleType="teacher"
          onStart={() => {
            setShowWelcome(false);
            setWelcomeMarked(true);
          }}
        />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#FAF9F6] text-[#1E1B4B]">
      <DashboardHeader />
      <ForgeGuideStrip />

      <WeeklyInsight
        totalLessons={stats.totalLessons}
        recent7d={stats.recent7d}
        creditsRemaining={creditsRemaining}
        worksheetsCreated={stats.worksheetsCreated}
      />

      <main className="mx-auto max-w-6xl space-y-6 px-6 py-8">
        {flowBusy ? (
          <AuthNotificationBanner
            type="info"
            icon="⏳"
            message="Finalising your LessonForge workspace..."
          />
        ) : null}

        {!isOutOfCredits ? (
          isLowCredits ? (
            <AuthNotificationBanner
              type="warning"
              icon={creditsRemaining === 1 ? "🔥" : "⚠️"}
              message={
                creditsRemaining === 1
                  ? "This is your last credit — use it well! Then explore our plans to keep generating."
                  : `Only ${creditsRemaining} credit${creditsRemaining > 1 ? "s" : ""} left — make them count.`
              }
              actions={[
                {
                  label: "View Plans",
                  href: "/pricing",
                  variant: "warning",
                },
              ]}
            />
          ) : (
            <AuthNotificationBanner
              type="info"
              icon="⚡"
              message={`You have ${creditsRemaining} credits · Start generating lesson packs and worksheets now.`}
            />
          )
        ) : null}

        {msg ? (
          <div className="rounded-[14px] border border-[#E2E8F0] bg-white p-4 text-sm text-[#475569] shadow-[0_4px_24px_rgba(83,74,183,0.08)]">
            {msg}
          </div>
        ) : null}

        {!schoolMembershipLoading && !hasSchoolMembership ? (
          <section className="rounded-2xl border border-violet-200 bg-violet-50/50 p-4 shadow-sm dark:border-violet-900/50 dark:bg-violet-900/10">
            <div className="mb-3">
              <h2 className="text-sm font-bold text-slate-900 dark:text-white">
                Join your school workspace
              </h2>
              <p className="mt-1 text-xs text-slate-600 dark:text-slate-400">
                Enter your school code from your principal to activate your
                teacher seat.
              </p>
            </div>
            <SchoolCodeInput
              redirectTo="/dashboard"
              onJoined={loadSchoolMembership}
            />
          </section>
        ) : null}

        <QuickActionsGrid />

        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <h2 className="text-sm font-bold text-slate-900 dark:text-white">
                Planning reminders
              </h2>
              <p className="mt-1 text-xs text-slate-600 dark:text-slate-400">
                Weekly topics and upcoming school events from your Planning
                tools.
              </p>
            </div>

            <Link
              href="/planning"
              className="inline-flex rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-800 hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
            >
              Open Planning
            </Link>
          </div>

          {planningMsg ? (
            <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800 dark:border-amber-900/50 dark:bg-amber-900/20 dark:text-amber-400">
              {planningMsg}
            </div>
          ) : null}

          <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-4">
            <PlanningReminderCard title="This Week's Topic">
              {loading ? (
                <ReminderLoading />
              ) : planningReminders.thisWeekTopic ? (
                <div>
                  <div className="text-sm font-semibold text-slate-900 dark:text-white">
                    {planningReminders.thisWeekTopic.topic}
                  </div>
                  <div className="mt-1 text-xs text-slate-600 dark:text-slate-400">
                    Week {planningReminders.thisWeekTopic.week_number} •{" "}
                    {planningReminders.thisWeekTopic.class_name} •{" "}
                    {planningReminders.thisWeekTopic.subject}
                  </div>
                </div>
              ) : (
                <EmptyReminder
                  text={`No topic assigned for week ${planningReminders.currentWeek}.`}
                />
              )}
            </PlanningReminderCard>

            <PlanningReminderCard title="Next Topic">
              {loading ? (
                <ReminderLoading />
              ) : planningReminders.nextTopic ? (
                <div>
                  <div className="text-sm font-semibold text-slate-900 dark:text-white">
                    {planningReminders.nextTopic.topic}
                  </div>
                  <div className="mt-1 text-xs text-slate-600 dark:text-slate-400">
                    Week {planningReminders.nextTopic.week_number} •{" "}
                    {planningReminders.nextTopic.term}
                  </div>
                </div>
              ) : (
                <EmptyReminder text="No upcoming topic yet." />
              )}
            </PlanningReminderCard>

            <PlanningReminderCard title="Upcoming Academic Event">
              {loading ? (
                <ReminderLoading />
              ) : planningReminders.upcomingEvent ? (
                <div>
                  <div className="text-sm font-semibold text-slate-900 dark:text-white">
                    {planningReminders.upcomingEvent.title}
                  </div>
                  <div className="mt-1 text-xs text-slate-600 dark:text-slate-400">
                    {formatEventDate(
                      planningReminders.upcomingEvent.event_date
                    )}{" "}
                    •{" "}
                    {formatEventType(
                      planningReminders.upcomingEvent.event_type
                    )}
                  </div>
                </div>
              ) : (
                <EmptyReminder text="No upcoming event in your calendar." />
              )}
            </PlanningReminderCard>

            <PlanningReminderCard title="Pending Topics Count">
              {loading ? (
                <ReminderLoading />
              ) : (
                <div>
                  <div className="text-2xl font-extrabold tracking-tight text-slate-900 dark:text-white">
                    {planningReminders.pendingTopicsCount}
                  </div>
                  <div className="mt-1 text-xs text-slate-600 dark:text-slate-400">
                    {planningReminders.pendingTopicsCount > 0
                      ? "Topics are still not completed."
                      : "All topics are completed. Great work."}
                  </div>
                </div>
              )}
            </PlanningReminderCard>
          </div>
        </section>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
          <section className="space-y-4 lg:col-span-10">
            <RecentActivity
              loading={loading}
              lessons={recent}
              deletingId={deletingId}
              onDelete={deleteLesson}
              formatDate={formatDate}
              relativeTime={relativeTime}
            />
          </section>
        </div>
      </main>
    </div>
  );
}

function PlanningReminderCard({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <article className="rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-800">
      <div className="text-xs font-semibold text-slate-600 dark:text-slate-400">{title}</div>
      <div className="mt-2">{children}</div>
    </article>
  );
}

function ReminderLoading() {
  return (
    <div className="space-y-2">
      <div className="h-4 w-24 rounded bg-slate-200 dark:bg-slate-700" />
      <div className="h-3 w-36 rounded bg-slate-200 dark:bg-slate-700" />
    </div>
  );
}

function EmptyReminder({ text }: { text: string }) {
  return <div className="text-sm text-slate-600 dark:text-slate-400">{text}</div>;
}
