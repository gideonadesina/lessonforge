"use client";

import { useEffect, useMemo, useState } from "react";
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
  provider: "paystack";
};

type DashboardApiResponse = {
  ok: boolean;
  onboardingRequired?: boolean;
  data?: PrincipalDashboardPayload;
  error?: string;
};

type ApiEnvelope<T> = {
  ok?: boolean;
  error?: string;
  data?: T;
  onboardingRequired?: boolean;
  [key: string]: unknown;
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

export default function PrincipalPage() {
  const supabase = useMemo(() => createBrowserSupabase(), []);

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

  async function requestWithAuth<T>(url: string, init: RequestInit = {}) {
    const token = await getToken();
    if (!token) {
      throw new Error("Session expired.");
    }

    const headers = new Headers(init.headers ?? {});
    headers.set("Authorization", `Bearer ${token}`);
    if (init.body && !headers.has("Content-Type")) {
      headers.set("Content-Type", "application/json");
    }

    const res = await fetch(url, { ...init, headers });
    const json = (await res.json().catch(() => ({}))) as ApiEnvelope<T>;
    return { status: res.status, ok: res.ok, json };
  }

  async function loadDashboard() {
    setLoading(true);
    setError(null);
    setForbidden(false);
    try {
      const { status, ok, json } = await requestWithAuth<PrincipalDashboardPayload>("/api/principal/dashboard");
      const typed = json as DashboardApiResponse;
      if (status === 403) {
        setForbidden(true);
        setDashboard(null);
        setOnboardingRequired(false);
        return;
      }
      if (!ok || !typed.ok) {
        throw new Error(typed.error || "Failed to load principal workspace.");
      }

      setOnboardingRequired(Boolean(typed.onboardingRequired));
      setDashboard(typed.data ?? null);
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
    const { ok, json } = await requestWithAuth<PaymentQuote>("/api/principal/payment/quote", {
      method: "POST",
      body: JSON.stringify({ teacherSlots }),
    });

    if (!ok || !json?.ok || !json?.data) {
      throw new Error(String(json?.error ?? "Failed to get payment quote."));
    }
    return json.data;
  }

  async function startPrincipalCheckout() {
    setOnboardingBusy(true);
    setError(null);
    try {
      const paymentQuote = quote ?? (await getQuote());
      const { ok, json } = await requestWithAuth<{ alreadyActivated?: boolean; authorizationUrl?: string }>(
        "/api/principal/payment/init",
        {
          method: "POST",
          body: JSON.stringify({
            principalName,
            schoolName,
            teacherSlots: paymentQuote.teacherSlots,
          }),
        }
      );

      if (!ok || !json?.ok) {
        throw new Error(String(json?.error ?? "Failed to initialize checkout."));
      }

      if (json?.data?.alreadyActivated) {
        setOnboardingRequired(false);
        setStep(1);
        await loadDashboard();
        return;
      }

      const authorizationUrl = String(json?.data?.authorizationUrl ?? "");
      if (!authorizationUrl) {
        throw new Error("Missing Paystack checkout URL.");
      }

      window.location.href = authorizationUrl;
    } catch (e: unknown) {
      setError(getErrorMessage(e, "Failed to start checkout."));
    } finally {
      setOnboardingBusy(false);
    }
  }

  async function handleTeacherAction(teacher: TeacherListItem, action: TeacherAction) {
    setBusyTeacherId(teacher.userId);
    setBusyTeacherAction(action);
    setError(null);
    try {
      const { ok, json } = await requestWithAuth("/api/principal/teachers", {
        method: "PATCH",
        body: JSON.stringify({
          teacherUserId: teacher.userId,
          action,
        }),
      });
      if (!ok || !json?.ok) throw new Error(String(json?.error ?? "Failed to update teacher."));
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
      const { ok, json } = await requestWithAuth("/api/principal/school-code", {
        method: "POST",
      });
      if (!ok || !json?.ok) throw new Error(String(json?.error ?? "Failed to regenerate school code."));
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
      const { ok, json } = await requestWithAuth("/api/principal/slots", {
        method: "POST",
        body: JSON.stringify({ addSlots }),
      });
      if (!ok || !json?.ok) throw new Error(String(json?.error ?? "Failed to add slots."));
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
                  onClick={startPrincipalCheckout}
                  disabled={onboardingBusy}
                  className="rounded-xl bg-violet-600 px-4 py-2 text-sm font-semibold text-white hover:bg-violet-700 disabled:opacity-60"
                >
                  {onboardingBusy ? "Redirecting..." : "Proceed to secure checkout"}
                </button>
              )}
            </div>
          </SectionCard>
        </div>
      ) : null}

      {!onboardingRequired && dashboard ? (
        <div className="space-y-4">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
            <MetricCard title="Total Teachers" value={dashboard.overview.totalTeachers} subtitle={`Slots: ${dashboard.subscription.slotLimit}`} />
            <MetricCard title="Active Teachers" value={dashboard.overview.activeTeachers} subtitle="Engaged this cycle" />
            <MetricCard title="Lessons Generated" value={dashboard.overview.totalLessonsGenerated} subtitle="Across all teachers" />
            <MetricCard title="Weekly Activity" value={dashboard.overview.weeklyActivityCount} subtitle="Last 7 days events" />
          </div>

          <div className="grid grid-cols-1 gap-4 xl:grid-cols-12">
            <div className="space-y-4 xl:col-span-8">
              <SectionCard
                title="Teacher management"
                subtitle="Track teacher health and manage access."
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

              <SectionCard title="Planning overview" subtitle="Scheme progress and upcoming academic events.">
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
              <SectionCard title="School code" subtitle="Share this code with teachers to join your workspace.">
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

              <SectionCard title="Subscription & billing" subtitle="Teacher seat capacity and billing history.">
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
            </aside>
          </div>
        </div>
      ) : null}
    </div>
  );
}