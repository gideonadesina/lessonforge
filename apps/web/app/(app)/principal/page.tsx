"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { createBrowserSupabase } from "@/lib/supabase/browser";
import MetricCard from "@/components/principal/MetricCard";
import SectionCard from "@/components/principal/SectionCard";
import StatusPill from "@/components/principal/StatusPill";
import type { PrincipalDashboardPayload, TeacherAction, TeacherListItem } from "@/lib/principal/types";

type PaymentQuote = {
  teacherSlots: number;
  slotPrice: number;
  amount: number;
  currency: "NGN" | "USD";
  billingCycle: "monthly";
  provider: "placeholder" | "paystack";
  reference: string;
};

type DashboardApiResponse = {
  ok: boolean;
  onboardingRequired?: boolean;
  data?: PrincipalDashboardPayload;
  error?: string;
};

function toNaira(amount: number) {
  return new Intl.NumberFormat("en-NG", {
    style: "currency",
    currency: "NGN",
    maximumFractionDigits: 0,
  }).format(amount);
}

function timeAgo(iso?: string | null) {
  if (!iso) return "No activity yet";
  const t = new Date(iso).getTime();
  if (!Number.isFinite(t)) return "No activity yet";
  const mins = Math.floor((Date.now() - t) / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

function getErrorMessage(err: unknown, fallback: string) {
  return err instanceof Error ? err.message : fallback;
}

function isSameDay(dateA: Date, dateB: Date) {
  return (
    dateA.getFullYear() === dateB.getFullYear() &&
    dateA.getMonth() === dateB.getMonth() &&
    dateA.getDate() === dateB.getDate()
  );
}

function formatShortDate(iso: string | null | undefined) {
  if (!iso) return "No date";
  const date = new Date(iso);
  if (!Number.isFinite(date.getTime())) return "No date";
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export default function PrincipalPage() {
  const supabase = useMemo(() => createBrowserSupabase(), []);
  const searchParams = useSearchParams();
  const selectedView = searchParams.get("view") ?? "dashboard";

  const [loading, setLoading] = useState(true);
  const [forbidden, setForbidden] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dashboard, setDashboard] = useState<PrincipalDashboardPayload | null>(null);
  const [onboardingRequired, setOnboardingRequired] = useState(false);

  // Onboarding state
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [principalName, setPrincipalName] = useState("");
  const [schoolName, setSchoolName] = useState("");
  const [teacherSlots, setTeacherSlots] = useState(12);
  const [quote, setQuote] = useState<PaymentQuote | null>(null);
  const [onboardingBusy, setOnboardingBusy] = useState(false);

  // Dashboard actions
  const [busyTeacherId, setBusyTeacherId] = useState<string | null>(null);
  const [busyTeacherAction, setBusyTeacherAction] = useState<TeacherAction | null>(null);
  const [codeBusy, setCodeBusy] = useState(false);
  const [slotUpgradeBusy, setSlotUpgradeBusy] = useState(false);
  const [addSlots, setAddSlots] = useState(1);

  async function getToken() {
    const { data } = await supabase.auth.getSession();
    return data.session?.access_token ?? "";
  }

  async function loadDashboard() {
    setLoading(true);
    setError(null);
    setForbidden(false);
    try {
      const token = await getToken();
      if (!token) throw new Error("Please login to continue.");

      const res = await fetch("/api/principal/dashboard", {
        headers: { Authorization: `Bearer ${token}` },
      });
      const json = (await res.json()) as DashboardApiResponse;

      if (res.status === 403) {
        setForbidden(true);
        setDashboard(null);
        setOnboardingRequired(false);
        return;
      }
      if (!res.ok || !json.ok) {
        throw new Error(json.error || "Failed to load principal workspace.");
      }

      setOnboardingRequired(Boolean(json.onboardingRequired));
      setDashboard(json.data ?? null);
    } catch (e: unknown) {
      setError(getErrorMessage(e, "Failed to load principal workspace."));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadDashboard();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function getQuote() {
    const token = await getToken();
    if (!token) throw new Error("Session expired.");

    const res = await fetch("/api/principal/payment/quote", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ teacherSlots }),
    });
    const json = await res.json();
    if (!res.ok || !json?.ok) throw new Error(json?.error || "Failed to get payment quote.");
    return json.data as PaymentQuote;
  }

  async function completeOnboarding() {
    setOnboardingBusy(true);
    setError(null);
    try {
      const token = await getToken();
      if (!token) throw new Error("Session expired.");

      const paymentQuote = quote ?? (await getQuote());
      const res = await fetch("/api/principal/onboarding", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          principalName,
          schoolName,
          teacherSlots,
          payment: {
            provider: paymentQuote.provider,
            reference: paymentQuote.reference,
            status: "success",
          },
        }),
      });
      const json = await res.json();

      if (!res.ok || !json?.ok) {
        throw new Error(json?.error || "Failed to create principal workspace.");
      }

      setOnboardingRequired(false);
      setStep(1);
      await loadDashboard();
    } catch (e: unknown) {
      setError(getErrorMessage(e, "Onboarding failed."));
    } finally {
      setOnboardingBusy(false);
    }
  }

  async function handleTeacherAction(teacher: TeacherListItem, action: TeacherAction) {
    setBusyTeacherId(teacher.userId);
    setBusyTeacherAction(action);
    setError(null);
    try {
      const token = await getToken();
      if (!token) throw new Error("Session expired.");

      const res = await fetch("/api/principal/teachers", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          teacherUserId: teacher.userId,
          action,
        }),
      });
      const json = await res.json();
      if (!res.ok || !json?.ok) throw new Error(json?.error || "Failed to update teacher.");
      await loadDashboard();
    } catch (e: unknown) {
      setError(getErrorMessage(e, "Failed to update teacher."));
    } finally {
      setBusyTeacherId(null);
      setBusyTeacherAction(null);
    }
  }

  async function regenerateCode() {
    setCodeBusy(true);
    setError(null);
    try {
      const token = await getToken();
      if (!token) throw new Error("Session expired.");

      const res = await fetch("/api/principal/school-code", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      const json = await res.json();
      if (!res.ok || !json?.ok) throw new Error(json?.error || "Failed to regenerate school code.");
      await loadDashboard();
    } catch (e: unknown) {
      setError(getErrorMessage(e, "Failed to regenerate code."));
    } finally {
      setCodeBusy(false);
    }
  }

  async function upgradeSlots() {
    setSlotUpgradeBusy(true);
    setError(null);
    try {
      const token = await getToken();
      if (!token) throw new Error("Session expired.");

      const res = await fetch("/api/principal/slots", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ addSlots }),
      });
      const json = await res.json();
      if (!res.ok || !json?.ok) throw new Error(json?.error || "Failed to add slots.");
      await loadDashboard();
    } catch (e: unknown) {
      setError(getErrorMessage(e, "Failed to add slots."));
    } finally {
      setSlotUpgradeBusy(false);
    }
  }

  async function copySchoolCode(code: string) {
    try {
      await navigator.clipboard.writeText(code);
    } catch {
      setError("Copy failed. Please copy manually.");
    }
  }

  const signals = useMemo(() => {
    if (!dashboard) {
      return {
        principalDisplayName: "Principal",
        todayActivityCount: 0,
        pendingActions: 0,
        inactiveTeachers: 0,
        slotsRemaining: 0,
        utilizationPercent: 0,
        recentTeacherActions: [] as TeacherListItem[],
        focusCard: {
          title: "Command center is ready",
          message: "Invite teachers and start school-wide planning to unlock daily leadership insights.",
          ctaLabel: "Invite teachers",
          ctaHref: "/principal?view=teachers",
          tone: "slate" as const,
        },
      };
    }

    const today = new Date();
    const todayActivityCount = dashboard.teachers.filter((teacher) => {
      if (!teacher.lastActiveAt) return false;
      const activeDate = new Date(teacher.lastActiveAt);
      return Number.isFinite(activeDate.getTime()) && isSameDay(activeDate, today);
    }).length;

    const inactiveTeachers = dashboard.teachers.filter(
      (teacher) => teacher.status === "disabled" || teacher.status === "pending"
    ).length;

    const slotsRemaining = Math.max(dashboard.subscription.slotLimit - dashboard.overview.totalTeachers, 0);
    const pendingActions =
      inactiveTeachers +
      (slotsRemaining <= 2 ? 1 : 0) +
      (dashboard.overview.weeklyActivityCount < Math.max(dashboard.overview.activeTeachers, 1) ? 1 : 0);

    const utilizationPercent = Math.round(
      (dashboard.overview.totalTeachers / Math.max(dashboard.subscription.slotLimit, 1)) * 100
    );

    const recentTeacherActions = [...dashboard.teachers]
      .sort((a, b) => {
        const aTime = a.lastActiveAt ? new Date(a.lastActiveAt).getTime() : 0;
        const bTime = b.lastActiveAt ? new Date(b.lastActiveAt).getTime() : 0;
        return bTime - aTime;
      })
      .slice(0, 5);

    const principalDisplayName = dashboard.school.principalName || "Principal";

    if (inactiveTeachers >= 3) {
      return {
        principalDisplayName,
        todayActivityCount,
        pendingActions,
        inactiveTeachers,
        slotsRemaining,
        utilizationPercent,
        recentTeacherActions,
        focusCard: {
          title: `${inactiveTeachers} teachers inactive this week`,
          message: "Re-engage your team now to keep lesson generation and planning on track.",
          ctaLabel: "Review teachers",
          ctaHref: "/principal?view=teachers",
          tone: "amber" as const,
        },
      };
    }

    if (slotsRemaining <= 2) {
      return {
        principalDisplayName,
        todayActivityCount,
        pendingActions,
        inactiveTeachers,
        slotsRemaining,
        utilizationPercent,
        recentTeacherActions,
        focusCard: {
          title: "Your slots are almost full",
          message: "Add more teacher slots now so new staff can onboard without delays.",
          ctaLabel: "Upgrade slots",
          ctaHref: "/principal?view=slots",
          tone: "violet" as const,
        },
      };
    }

    if (dashboard.overview.weeklyActivityCount < Math.max(dashboard.overview.totalTeachers, 1) * 2) {
      return {
        principalDisplayName,
        todayActivityCount,
        pendingActions,
        inactiveTeachers,
        slotsRemaining,
        utilizationPercent,
        recentTeacherActions,
        focusCard: {
          title: "Lesson generation is down this week",
          message: "Prompt departments to generate this week’s lessons and close planning gaps.",
          ctaLabel: "Generate overview",
          ctaHref: "/principal?view=generate",
          tone: "blue" as const,
        },
      };
    }

    return {
      principalDisplayName,
      todayActivityCount,
      pendingActions,
      inactiveTeachers,
      slotsRemaining,
      utilizationPercent,
      recentTeacherActions,
      focusCard: {
        title: "Your school is in a healthy rhythm",
        message: "Keep momentum by reviewing teacher actions and pushing weekly priorities.",
        ctaLabel: "View analytics",
        ctaHref: "/principal?view=analytics",
        tone: "emerald" as const,
      },
    };
  }, [dashboard]);

  const highlightedSection = (viewName: string) =>
    selectedView === viewName
      ? "border-violet-200 shadow-[0_8px_28px_rgba(109,40,217,0.12)]"
      : "border-violet-100/80";

  const focusToneClass = {
    slate: "border-slate-200 bg-slate-50",
    amber: "border-amber-200 bg-amber-50",
    violet: "border-violet-200 bg-violet-50",
    blue: "border-blue-200 bg-blue-50",
    emerald: "border-emerald-200 bg-emerald-50",
  }[signals.focusCard.tone];

  if (loading) {
    return (
      <div className="rounded-3xl border border-violet-100 bg-amber-50/70 p-8 text-sm text-slate-700 shadow-sm">
        Loading principal workspace...
      </div>
    );
  }

  if (forbidden) {
    return (
      <div className="rounded-3xl border border-red-200 bg-red-50 p-8 shadow-sm">
        <h1 className="text-2xl font-black text-slate-900">Principal access only</h1>
        <p className="mt-2 text-sm text-red-700">
          This route is restricted to principal/school-admin accounts.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-5 rounded-3xl bg-amber-50/70 p-4 md:p-6">
      <header className="rounded-2xl border border-violet-100 bg-white px-5 py-4 shadow-[0_6px_24px_rgba(88,28,135,0.08)]">
        <p className="text-xs font-semibold uppercase tracking-wide text-violet-700">LessonForge School Workspace</p>
        <h1 className="mt-1 text-2xl font-black tracking-tight text-slate-900">Principal Dashboard</h1>
        <p className="mt-1 text-sm text-slate-600">
          Manage teachers, subscriptions, activity, and planning oversight in one controlled workspace.
        </p>
      </header>

      {error ? (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
      ) : null}

      {onboardingRequired ? (
        <div className="space-y-4">
          <SectionCard
            title="School setup"
            subtitle="Set up your principal workspace in three quick steps."
            action={<div className="text-xs text-slate-500">Step {step} of 3</div>}
          >
            <div className="grid grid-cols-3 gap-2 pb-2">
              {[1, 2, 3].map((n) => (
                <div key={n} className={`h-1.5 rounded-full ${step >= n ? "bg-violet-600" : "bg-slate-200"}`} />
              ))}
            </div>

            {step === 1 ? (
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                <label className="space-y-1">
                  <span className="text-xs font-semibold uppercase tracking-wide text-slate-600">Principal name</span>
                  <input
                    value={principalName}
                    onChange={(e) => setPrincipalName(e.target.value)}
                    placeholder="e.g. Amaka Nwosu"
                    className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-violet-500"
                  />
                </label>
                <label className="space-y-1">
                  <span className="text-xs font-semibold uppercase tracking-wide text-slate-600">School name</span>
                  <input
                    value={schoolName}
                    onChange={(e) => setSchoolName(e.target.value)}
                    placeholder="e.g. Meadowfield College"
                    className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-violet-500"
                  />
                </label>
              </div>
            ) : null}

            {step === 2 ? (
              <div className="space-y-3">
                <div className="rounded-xl border border-slate-200 bg-amber-50/60 p-4">
                  <p className="text-sm font-semibold text-slate-900">Choose teacher slots</p>
                  <p className="mt-1 text-sm text-slate-600">You are billed per teacher seat, monthly.</p>
                  <div className="mt-4 flex items-center gap-3">
                    <input
                      type="range"
                      min={1}
                      max={100}
                      value={teacherSlots}
                      onChange={(e) => setTeacherSlots(Number(e.target.value))}
                      className="w-full accent-violet-600"
                    />
                    <div className="min-w-[64px] rounded-lg border border-violet-200 bg-white px-2 py-1 text-center text-sm font-bold text-violet-700">
                      {teacherSlots}
                    </div>
                  </div>
                </div>
              </div>
            ) : null}

            {step === 3 ? (
              <div className="space-y-3">
                <div className="rounded-xl border border-violet-200 bg-violet-50/50 p-4">
                  <p className="text-sm font-bold text-slate-900">Payment summary</p>
                  <div className="mt-2 grid grid-cols-1 gap-2 text-sm text-slate-700 md:grid-cols-2">
                    <div>School: <span className="font-semibold text-slate-900">{schoolName || "—"}</span></div>
                    <div>Principal: <span className="font-semibold text-slate-900">{principalName || "—"}</span></div>
                    <div>Teacher slots: <span className="font-semibold text-slate-900">{teacherSlots}</span></div>
                    <div>
                      Monthly total:{" "}
                      <span className="font-semibold text-violet-700">
                        {quote ? toNaira(quote.amount) : "Fetching..."}
                      </span>
                    </div>
                  </div>
                  <p className="mt-3 text-xs text-slate-500">
                    Placeholder payment mode is active. This is ready to swap with real gateway checkout.
                  </p>
                </div>
              </div>
            ) : null}

            <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
              <button
                onClick={() => setStep((s) => (s > 1 ? ((s - 1) as 1 | 2 | 3) : s))}
                disabled={onboardingBusy || step === 1}
                className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
              >
                Back
              </button>

              {step < 3 ? (
                <button
                  onClick={async () => {
                    if (step === 1 && (!principalName.trim() || !schoolName.trim())) {
                      setError("Please enter principal and school name.");
                      return;
                    }
                    if (step === 2) {
                      try {
                        setError(null);
                        const nextQuote = await getQuote();
                        setQuote(nextQuote);
                      } catch (e: unknown) {
                        setError(getErrorMessage(e, "Failed to get quote."));
                        return;
                      }
                    }
                    setStep((s) => (s < 3 ? ((s + 1) as 1 | 2 | 3) : s));
                  }}
                  disabled={onboardingBusy}
                  className="rounded-xl bg-violet-600 px-4 py-2 text-sm font-semibold text-white hover:bg-violet-700 disabled:opacity-60"
                >
                  Continue
                </button>
              ) : (
                <button
                  onClick={completeOnboarding}
                  disabled={onboardingBusy}
                  className="rounded-xl bg-violet-600 px-4 py-2 text-sm font-semibold text-white hover:bg-violet-700 disabled:opacity-60"
                >
                  {onboardingBusy ? "Processing..." : "Complete payment & create workspace"}
                </button>
              )}
            </div>
          </SectionCard>
        </div>
      ) : null}

      {!onboardingRequired && dashboard ? (
        <div className="space-y-4">
          <section
            className={[
              "rounded-2xl border bg-white p-5 shadow-[0_6px_24px_rgba(88,28,135,0.08)]",
              highlightedSection("dashboard"),
            ].join(" ")}
            id="dashboard-overview"
          >
            <div className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1.6fr)_minmax(280px,1fr)]">
              <div className="min-w-0 space-y-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-violet-700">Principal command center</p>
                <h2 className="text-xl font-black tracking-tight text-slate-900 sm:text-2xl">
                  {signals.principalDisplayName}, your school needs your leadership today.
                </h2>
                <p className="text-sm text-slate-600">
                  {dashboard.school.name} • Daily summary for {formatShortDate(new Date().toISOString())}
                </p>

                <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                  <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                    <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Active teachers</div>
                    <div className="mt-1 text-2xl font-bold text-slate-900">{dashboard.overview.activeTeachers}</div>
                  </div>
                  <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                    <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Today activity</div>
                    <div className="mt-1 text-2xl font-bold text-slate-900">{signals.todayActivityCount}</div>
                  </div>
                  <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                    <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Pending actions</div>
                    <div className="mt-1 text-2xl font-bold text-slate-900">{signals.pendingActions}</div>
                  </div>
                </div>
              </div>

              <div className="min-w-0 xl:min-w-[280px]">
                <div className={["rounded-xl border p-4", focusToneClass].join(" ")}>
                  <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Focus card</div>
                  <h3 className="mt-2 text-lg font-bold text-slate-900">{signals.focusCard.title}</h3>
                  <p className="mt-2 text-sm text-slate-700">{signals.focusCard.message}</p>
                  <Link
                    href={signals.focusCard.ctaHref}
                    className="mt-4 inline-flex rounded-xl bg-slate-900 px-3 py-2 text-xs font-semibold text-white transition hover:bg-slate-800"
                  >
                    {signals.focusCard.ctaLabel}
                  </Link>
                </div>
              </div>
            </div>
          </section>

          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
            <MetricCard title="Total Teachers" value={dashboard.overview.totalTeachers} subtitle={`Slots: ${dashboard.subscription.slotLimit}`} />
            <MetricCard title="Active Teachers" value={dashboard.overview.activeTeachers} subtitle="Engaged this cycle" />
            <MetricCard title="Lessons Generated" value={dashboard.overview.totalLessonsGenerated} subtitle="Across all teachers" />
            <MetricCard title="Weekly Activity" value={dashboard.overview.weeklyActivityCount} subtitle="Last 7 days events" />
          </div>

          <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
            <SectionCard
              title="Generation oversight"
              subtitle="School-wide generation signal so you can nudge the right teams quickly."
              className={highlightedSection("generate")}
            >
              <div className="space-y-3 text-sm text-slate-700">
                <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
                  <span>Lessons generated</span>
                  <span className="font-bold text-slate-900">{dashboard.overview.totalLessonsGenerated}</span>
                </div>
                <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
                  <span>Weekly activity</span>
                  <span className="font-bold text-slate-900">{dashboard.overview.weeklyActivityCount}</span>
                </div>
                <Link
                  href="/principal?view=generate"
                  className="inline-flex rounded-xl border border-violet-200 bg-violet-50 px-3 py-2 text-xs font-semibold text-violet-700 hover:bg-violet-100"
                >
                  Generate this week&apos;s lessons
                </Link>
              </div>
            </SectionCard>

            <SectionCard
              title="Library oversight"
              subtitle="Track reusable content and open school-wide resources in one click."
              className={highlightedSection("library")}
            >
              <div className="space-y-3 text-sm text-slate-700">
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Estimated resources</p>
                  <p className="mt-1 text-2xl font-bold text-slate-900">
                    {dashboard.overview.totalLessonsGenerated + dashboard.teachers.reduce((sum, teacher) => sum + teacher.worksheetsCreated, 0)}
                  </p>
                  <p className="mt-1 text-xs text-slate-500">Lessons + worksheets across all teachers</p>
                </div>
                <Link
                  href="/principal?view=library"
                  className="inline-flex rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                >
                  View all generated content
                </Link>
              </div>
            </SectionCard>
          </div>

          <div className="grid grid-cols-1 gap-4 xl:grid-cols-12">
            <div className="space-y-4 xl:col-span-8">
              <SectionCard
                title="Recent teacher actions"
                subtitle="Today’s movement across your team."
                className={highlightedSection("analytics")}
              >
                <div className="space-y-2">
                  {signals.recentTeacherActions.length ? (
                    signals.recentTeacherActions.map((teacher) => (
                      <div key={`recent-${teacher.userId}`} className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
                        <div>
                          <p className="text-sm font-semibold text-slate-900">{teacher.name}</p>
                          <p className="text-xs text-slate-500">{teacher.email || "No email"}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-xs font-semibold text-slate-700">{timeAgo(teacher.lastActiveAt)}</p>
                          <p className="text-[11px] text-slate-500">Last active</p>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
                      Teacher actions will appear here as your school starts using LessonForge.
                    </div>
                  )}
                </div>
              </SectionCard>

              <SectionCard
                title="Teacher management"
                subtitle="Track teacher health and manage access."
                className={highlightedSection("teachers")}
                action={
                  <button
                    onClick={() => {
                      setAddSlots(1);
                      upgradeSlots();
                    }}
                    disabled={slotUpgradeBusy}
                    className="rounded-lg border border-violet-200 bg-violet-50 px-3 py-2 text-xs font-semibold text-violet-700 hover:bg-violet-100 disabled:opacity-60"
                  >
                    {slotUpgradeBusy ? "Updating..." : "Add teacher slot"}
                  </button>
                }
              >
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[760px] text-sm">
                    <thead>
                      <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-500">
                        <th className="py-2">Teacher</th>
                        <th className="py-2">Status</th>
                        <th className="py-2">Lessons</th>
                        <th className="py-2">Worksheets</th>
                        <th className="py-2">Last active</th>
                        <th className="py-2 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {dashboard.teachers.length ? (
                        dashboard.teachers.map((teacher) => {
                          const isBusy = busyTeacherId === teacher.userId;
                          return (
                            <tr key={teacher.userId} className="border-b border-slate-100">
                              <td className="py-3">
                                <div className="font-semibold text-slate-900">{teacher.name}</div>
                                <div className="text-xs text-slate-500">{teacher.email || teacher.userId}</div>
                              </td>
                              <td className="py-3"><StatusPill status={teacher.status} /></td>
                              <td className="py-3 text-slate-700">{teacher.lessonsGenerated}</td>
                              <td className="py-3 text-slate-700">{teacher.worksheetsCreated}</td>
                              <td className="py-3 text-slate-600">{timeAgo(teacher.lastActiveAt)}</td>
                              <td className="py-3">
                                <div className="flex items-center justify-end gap-2">
                                  {teacher.status === "disabled" ? (
                                    <button
                                      onClick={() => handleTeacherAction(teacher, "activate")}
                                      disabled={isBusy}
                                      className="rounded-lg border border-emerald-200 bg-emerald-50 px-2.5 py-1.5 text-xs font-semibold text-emerald-700 hover:bg-emerald-100 disabled:opacity-60"
                                    >
                                      {isBusy && busyTeacherAction === "activate" ? "..." : "Activate"}
                                    </button>
                                  ) : (
                                    <button
                                      onClick={() => handleTeacherAction(teacher, "disable")}
                                      disabled={isBusy}
                                      className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60"
                                    >
                                      {isBusy && busyTeacherAction === "disable" ? "..." : "Disable"}
                                    </button>
                                  )}
                                  <button
                                    onClick={() => handleTeacherAction(teacher, "remove")}
                                    disabled={isBusy}
                                    className="rounded-lg border border-rose-200 bg-rose-50 px-2.5 py-1.5 text-xs font-semibold text-rose-700 hover:bg-rose-100 disabled:opacity-60"
                                  >
                                    {isBusy && busyTeacherAction === "remove" ? "..." : "Remove"}
                                  </button>
                                </div>
                              </td>
                            </tr>
                          );
                        })
                      ) : (
                        <tr>
                          <td colSpan={6} className="py-6 text-center text-sm text-slate-500">
                            No teachers yet. Share your school code so teachers can join.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </SectionCard>

              <SectionCard
                title="Activity monitoring"
                subtitle="Teacher usage snapshot for lesson and worksheet production."
                className={highlightedSection("analytics")}
              >
                <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                  {dashboard.teachers.slice(0, 6).map((teacher) => (
                    <div key={`activity-${teacher.userId}`} className="rounded-xl border border-slate-200 bg-amber-50/60 p-3">
                      <div className="flex items-start justify-between">
                        <div>
                          <div className="font-semibold text-slate-900">{teacher.name}</div>
                          <div className="text-xs text-slate-500">{teacher.email || "No email"}</div>
                        </div>
                        <StatusPill status={teacher.status} />
                      </div>
                      <div className="mt-3 grid grid-cols-3 gap-2 text-center">
                        <div className="rounded-lg bg-white p-2">
                          <div className="text-[11px] text-slate-500">Lessons</div>
                          <div className="text-lg font-bold text-slate-900">{teacher.lessonsGenerated}</div>
                        </div>
                        <div className="rounded-lg bg-white p-2">
                          <div className="text-[11px] text-slate-500">Worksheets</div>
                          <div className="text-lg font-bold text-slate-900">{teacher.worksheetsCreated}</div>
                        </div>
                        <div className="rounded-lg bg-white p-2">
                          <div className="text-[11px] text-slate-500">Last active</div>
                          <div className="text-xs font-semibold text-slate-900">{timeAgo(teacher.lastActiveAt)}</div>
                        </div>
                      </div>
                    </div>
                  ))}
                  {!dashboard.teachers.length ? (
                    <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
                      Activity cards will appear once teachers join your school code.
                    </div>
                  ) : null}
                </div>
              </SectionCard>

              <SectionCard
                title="Planning overview"
                subtitle="Scheme progress and upcoming academic events."
                className={highlightedSection("planning")}
              >
                <div className="space-y-4">
                  <div>
                    <div className="mb-2 flex items-center justify-between text-sm">
                      <span className="font-semibold text-slate-800">Scheme of work progress</span>
                      <span className="font-bold text-violet-700">{dashboard.planning.schemeProgressPercent}%</span>
                    </div>
                    <div className="h-2.5 w-full rounded-full bg-slate-200">
                      <div
                        className="h-2.5 rounded-full bg-gradient-to-r from-violet-500 to-purple-600"
                        style={{ width: `${dashboard.planning.schemeProgressPercent}%` }}
                      />
                    </div>
                    <p className="mt-2 text-xs text-slate-600">
                      {dashboard.planning.completedSchemeMilestones} / {dashboard.planning.totalSchemeMilestones} milestones completed.
                    </p>
                  </div>

                  <div className="grid grid-cols-1 gap-2">
                    {dashboard.planning.upcomingAcademicEvents.map((event) => (
                      <div key={event.id} className="flex items-center justify-between rounded-lg border border-slate-200 bg-white px-3 py-2">
                        <div>
                          <div className="text-sm font-semibold text-slate-900">{event.title}</div>
                          <div className="text-xs uppercase tracking-wide text-slate-500">{event.category}</div>
                        </div>
                        <div className="text-xs font-semibold text-slate-600">{event.startsAt}</div>
                      </div>
                    ))}
                  </div>
                </div>
              </SectionCard>
            </div>

            <aside className="space-y-4 xl:col-span-4">
              <SectionCard
                title="Daily leadership summary"
                subtitle="Signals that matter for today’s decisions."
                className={highlightedSection("dashboard")}
              >
                <div className="space-y-3 text-sm text-slate-700">
                  <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
                    <span>Slot utilization</span>
                    <span className="font-bold text-slate-900">{signals.utilizationPercent}%</span>
                  </div>
                  <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
                    <span>Inactive teachers</span>
                    <span className="font-bold text-slate-900">{signals.inactiveTeachers}</span>
                  </div>
                  <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
                    <span>Slots remaining</span>
                    <span className="font-bold text-slate-900">{signals.slotsRemaining}</span>
                  </div>
                </div>
              </SectionCard>

              <SectionCard
                title="School workspace"
                subtitle="Share this code with teachers to join your workspace."
                className={highlightedSection("workspace")}
              >
                <div className="space-y-3">
                  <div className="rounded-xl border border-violet-200 bg-violet-50 p-3">
                    <div className="text-xs uppercase tracking-wide text-violet-700">School code</div>
                    <div className="mt-1 font-mono text-xl font-black tracking-wider text-slate-900">
                      {dashboard.school.code}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => copySchoolCode(dashboard.school.code)}
                      className="flex-1 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                    >
                      Copy
                    </button>
                    <button
                      onClick={regenerateCode}
                      disabled={codeBusy}
                      className="flex-1 rounded-lg bg-violet-600 px-3 py-2 text-sm font-semibold text-white hover:bg-violet-700 disabled:opacity-60"
                    >
                      {codeBusy ? "Regenerating..." : "Regenerate"}
                    </button>
                  </div>
                </div>
              </SectionCard>

              <SectionCard
                title="Subscription & billing"
                subtitle="Teacher seat capacity and billing history."
                className={highlightedSection("billing")}
              >
                <div className="space-y-3">
                  <div className="rounded-xl border border-slate-200 bg-amber-50/60 p-3 text-sm">
                    <div className="flex items-center justify-between">
                      <span className="text-slate-600">Plan</span>
                      <span className="font-semibold text-slate-900">{dashboard.subscription.planName}</span>
                    </div>
                    <div className="mt-1 flex items-center justify-between">
                      <span className="text-slate-600">Teacher slots</span>
                      <span className="font-semibold text-slate-900">{dashboard.subscription.slotLimit}</span>
                    </div>
                    <div className="mt-1 flex items-center justify-between">
                      <span className="text-slate-600">Monthly amount</span>
                      <span className="font-semibold text-violet-700">{toNaira(dashboard.subscription.amountPerCycle)}</span>
                    </div>
                  </div>

                  <div
                    className={[
                      "rounded-xl border p-2",
                      selectedView === "slots" ? "border-violet-200 bg-violet-50/60" : "border-transparent bg-transparent",
                    ].join(" ")}
                  >
                    <div className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-slate-500">Slot management</div>
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        min={1}
                        value={addSlots}
                        onChange={(e) => setAddSlots(Math.max(1, Number(e.target.value || 1)))}
                        className="w-20 rounded-lg border border-slate-200 bg-white px-2 py-2 text-sm outline-none focus:border-violet-500"
                      />
                      <button
                        onClick={upgradeSlots}
                        disabled={slotUpgradeBusy}
                        className="flex-1 rounded-lg bg-violet-600 px-3 py-2 text-sm font-semibold text-white hover:bg-violet-700 disabled:opacity-60"
                      >
                        {slotUpgradeBusy ? "Updating..." : "Upgrade slots"}
                      </button>
                    </div>
                  </div>

                  <div className="rounded-xl border border-slate-200 bg-white p-3">
                    <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Billing history</div>
                    <div className="mt-2 space-y-2">
                      {dashboard.billingHistory.slice(0, 5).map((item) => (
                        <div key={item.id} className="flex items-center justify-between text-xs">
                          <span className="font-medium text-slate-700">{toNaira(item.amount)}</span>
                          <span className="rounded-full bg-slate-100 px-2 py-1 capitalize text-slate-600">{item.status}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </SectionCard>

              <SectionCard
                title="Notifications & actions"
                subtitle="Important alerts only, with clear next steps."
                className={highlightedSection("notifications")}
              >
                <div className="space-y-2">
                  {signals.inactiveTeachers > 0 ? (
                    <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
                      {signals.inactiveTeachers} teachers need attention this week.
                    </div>
                  ) : null}
                  {signals.slotsRemaining <= 2 ? (
                    <div className="rounded-xl border border-violet-200 bg-violet-50 p-3 text-sm text-violet-900">
                      Your school has only {signals.slotsRemaining} slot(s) remaining.
                    </div>
                  ) : null}
                  {dashboard.overview.weeklyActivityCount < Math.max(1, dashboard.overview.activeTeachers) ? (
                    <div className="rounded-xl border border-blue-200 bg-blue-50 p-3 text-sm text-blue-900">
                      Weekly generation is below your active teacher baseline.
                    </div>
                  ) : null}
                  {signals.inactiveTeachers === 0 &&
                  signals.slotsRemaining > 2 &&
                  dashboard.overview.weeklyActivityCount >= Math.max(1, dashboard.overview.activeTeachers) ? (
                    <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-900">
                      No urgent alerts. Your school workflow is stable.
                    </div>
                  ) : null}
                </div>

                <div className="mt-3 flex flex-wrap gap-2">
                  <Link
                    href="/principal?view=teachers"
                    className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                  >
                    Invite teachers
                  </Link>
                  <Link
                    href="/principal?view=generate"
                    className="rounded-lg border border-violet-200 bg-violet-50 px-3 py-2 text-xs font-semibold text-violet-700 hover:bg-violet-100"
                  >
                    Generate this week&apos;s lessons
                  </Link>
                  <Link
                    href="/principal?view=slots"
                    className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                  >
                    Upgrade slots
                  </Link>
                </div>
              </SectionCard>

              <SectionCard
                title="System settings"
                subtitle="Account and school controls."
                className={highlightedSection("settings")}
              >
                <div className="space-y-2">
                  <Link
                    href="/principal?view=settings"
                    className="flex items-center justify-between rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
                  >
                    <span>Account settings</span>
                    <span>→</span>
                  </Link>
                  <Link
                    href="/principal?view=workspace"
                    className="flex items-center justify-between rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
                  >
                    <span>School settings</span>
                    <span>→</span>
                  </Link>
                </div>
              </SectionCard>
            </aside>
          </div>
        </div>
      ) : null}
    </div>
  );
}