"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { createBrowserSupabase } from "@/lib/supabase/browser";
import { useProfile } from "@/lib/useProfile";
import DashboardHeader from "@/components/dashboard/DashboardHeader";
import ForgeGuideStrip from "@/components/dashboard/ForgeGuideStrip";
import QuickActionsGrid from "@/components/dashboard/QuickActionsGrid";
import PlanningStatusCard from "@/components/dashboard/PlanningStatusCard";
import RecentActivity from "@/components/dashboard/RecentActivity";
import WeeklyInsight from "@/components/dashboard/WeeklyInsight";
import { listSchemeOfWork } from "@/lib/planning/scheme";
import { listAcademicEvents } from "@/lib/planning/academicCalender";
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

type LessonRow = {
  id: string;
  subject: string | null;
  topic: string | null;
  grade: string | null;
  curriculum: string | null;
  created_at: string;
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

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

function getErrorMessage(error: unknown) {
  if (error instanceof Error) return error.message;
  return String(error);
}

export default function DashboardPage() {
  const router = useRouter();
  const supabase = useMemo(() => createBrowserSupabase(), []);

  const { profile, creditsRemaining, planLabel } = useProfile();

  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [lessons, setLessons] = useState<LessonRow[]>([]);
  const [worksheetsCount, setWorksheetsCount] = useState(0);
  const [schemeRows, setSchemeRows] = useState<SchemeOfWorkRow[]>([]);
  const [academicEvents, setAcademicEvents] = useState<AcademicCalendarRow[]>([]);

  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState<string | null>(null);
  const [planningMsg, setPlanningMsg] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const teacherName =
    (profile as any)?.full_name ||
    (profile as any)?.name ||
    userEmail?.split("@")[0] ||
    "Teacher";

  useEffect(() => {
    (window as any).__FORGE_CONTEXT__ = {
      page: "dashboard",
      teacherName,
      credits: creditsRemaining,
      plan: planLabel,
      recentLessons: lessons.slice(0, 5),
    };
  }, [teacherName, creditsRemaining, planLabel, lessons]);

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

        const [lessonsRes, worksheetsRes, schemeRes, eventsRes] = await Promise.all([
          supabase
            .from("lessons")
            .select("id, subject, topic, grade, curriculum, created_at")
            .order("created_at", { ascending: false })
            .limit(200),
          supabase.from("worksheets").select("id", { count: "exact", head: true }),
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
          console.warn("Failed to load worksheets count:", worksheetsRes.error.message);
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

  async function logout() {
    setMsg(null);
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

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

  const activityBars = useMemo(() => {
    const days = 7;
    const buckets = Array.from({ length: days }, () => 0);
    const now = new Date();
    const start = new Date(now);
    start.setDate(now.getDate() - (days - 1));
    start.setHours(0, 0, 0, 0);

    for (const lesson of lessons) {
      const t = new Date(lesson.created_at);
      if (Number.isNaN(t.getTime())) continue;
      const diffDays = Math.floor(
        (t.getTime() - start.getTime()) / (24 * 60 * 60 * 1000)
      );
      if (diffDays >= 0 && diffDays < days) buckets[diffDays] += 1;
    }

    const max = Math.max(1, ...buckets);

    return buckets.map((value) => ({
      value,
      heightPct: clamp(Math.round((value / max) * 100), 6, 100),
    }));
  }, [lessons]);

  const recent = useMemo(() => lessons.slice(0, 8), [lessons]);

  const planningReminders = useMemo(() => {
    const currentWeek = getWeekNumber(new Date());

    const orderedScheme = [...schemeRows].sort((a, b) => {
      if (a.week_number !== b.week_number) {
        return a.week_number - b.week_number;
      }
      return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
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

  const schemeUploaded = schemeRows.length > 0;
  const calendarUploaded = academicEvents.length > 0;
  const curriculumCount = new Set(
    lessons.map((lesson) => lesson.curriculum).filter(Boolean)
  ).size;
  const configuredClasses = new Set(
    schemeRows.map((row) => row.class_name).filter(Boolean)
  ).size;
  const pendingItems = planningReminders.pendingTopicsCount;

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <DashboardHeader />
      <ForgeGuideStrip />

      <WeeklyInsight
        totalLessons={stats.totalLessons}
        recent7d={stats.recent7d}
        creditsRemaining={creditsRemaining}
        worksheetsCreated={stats.worksheetsCreated}
      />

      <main className="mx-auto max-w-6xl space-y-6 px-6 py-8">
        {msg ? (
          <div className="rounded-2xl border border-slate-200 bg-white p-4 text-sm text-slate-800 shadow-sm">
            {msg}
          </div>
        ) : null}

        <QuickActionsGrid />

        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <h2 className="text-sm font-bold text-slate-900">Planning reminders</h2>
              <p className="mt-1 text-xs text-slate-600">
                Weekly topics and upcoming school events from your Planning tools.
              </p>
            </div>

            <Link
              href="/planning"
              className="inline-flex rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-800 hover:bg-slate-50"
            >
              Open Planning
            </Link>
          </div>

          {planningMsg ? (
            <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
              {planningMsg}
            </div>
          ) : null}

          <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-4">
            <PlanningReminderCard title="This Week's Topic">
              {loading ? (
                <ReminderLoading />
              ) : planningReminders.thisWeekTopic ? (
                <div>
                  <div className="text-sm font-semibold text-slate-900">
                    {planningReminders.thisWeekTopic.topic}
                  </div>
                  <div className="mt-1 text-xs text-slate-600">
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
                  <div className="text-sm font-semibold text-slate-900">
                    {planningReminders.nextTopic.topic}
                  </div>
                  <div className="mt-1 text-xs text-slate-600">
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
                  <div className="text-sm font-semibold text-slate-900">
                    {planningReminders.upcomingEvent.title}
                  </div>
                  <div className="mt-1 text-xs text-slate-600">
                    {formatEventDate(planningReminders.upcomingEvent.event_date)} •{" "}
                    {formatEventType(planningReminders.upcomingEvent.event_type)}
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
                  <div className="text-2xl font-extrabold tracking-tight text-slate-900">
                    {planningReminders.pendingTopicsCount}
                  </div>
                  <div className="mt-1 text-xs text-slate-600">
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
    <article className="rounded-xl border border-slate-200 bg-slate-50 p-4">
      <div className="text-xs font-semibold text-slate-600">{title}</div>
      <div className="mt-2">{children}</div>
    </article>
  );
}

function ReminderLoading() {
  return (
    <div className="space-y-2">
      <div className="h-4 w-24 rounded bg-slate-200" />
      <div className="h-3 w-36 rounded bg-slate-200" />
    </div>
  );
}

function EmptyReminder({ text }: { text: string }) {
  return <div className="text-sm text-slate-600">{text}</div>;
}