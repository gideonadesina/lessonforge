"use client";

import { useEffect, useState } from "react";
import MetricCard from "@/components/principal/MetricCard";
import PrincipalPageHeader from "@/components/principal/PrincipalPageHeader";
import SectionCard from "@/components/principal/SectionCard";
import StatusPill from "@/components/principal/StatusPill";
import {
  PrincipalForbiddenState,
  PrincipalLoadingState,
  PrincipalOnboardingRequiredState,
} from "@/components/principal/PrincipalStates";
import { getErrorMessage, timeAgo, usePrincipalDashboard } from "@/lib/principal/client";
import type { TeacherAction, TeacherListItem } from "@/lib/principal/types";

export default function PrincipalTeachersPage() {
  const { loading, forbidden, error, setError, dashboard, onboardingRequired, getToken, loadDashboard } =
    usePrincipalDashboard();
  const [busyTeacherId, setBusyTeacherId] = useState<string | null>(null);
  const [busyTeacherAction, setBusyTeacherAction] = useState<TeacherAction | null>(null);
  const [slotUpgradeBusy, setSlotUpgradeBusy] = useState(false);
  const [addSlots, setAddSlots] = useState(1);

  useEffect(() => {
    void loadDashboard();
  }, [loadDashboard]);

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
    } catch (err: unknown) {
      setError(getErrorMessage(err, "Failed to update teacher."));
    } finally {
      setBusyTeacherId(null);
      setBusyTeacherAction(null);
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
    } catch (err: unknown) {
      setError(getErrorMessage(err, "Failed to add slots."));
    } finally {
      setSlotUpgradeBusy(false);
    }
  }

  if (loading) return <PrincipalLoadingState />;
  if (forbidden) return <PrincipalForbiddenState />;
  if (onboardingRequired) return <PrincipalOnboardingRequiredState />;

  return (
    <div className="space-y-5 rounded-3xl bg-[var(--bg)] p-4 md:p-6">
      <PrincipalPageHeader
        eyebrow="Principal Operations"
        title="Teacher Management"
        description="Manage teacher access, monitor activity, and keep seat capacity in sync with staffing."
      />

      {error ? (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900/50 dark:bg-red-900/20 dark:text-red-400">{error}</div>
      ) : null}

      {dashboard ? (
        <div className="space-y-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <MetricCard title="Teachers" value={dashboard.overview.totalTeachers} subtitle="Current members in school workspace" />
            <MetricCard title="Active" value={dashboard.overview.activeTeachers} subtitle="Enabled teacher accounts" />
            <MetricCard title="Slots" value={dashboard.subscription.slotLimit} subtitle="Provisioned teacher capacity" />
            <MetricCard title="Weekly activity" value={dashboard.overview.weeklyActivityCount} subtitle="Lessons + worksheets events" />
          </div>

          <SectionCard
            title="Teacher roster"
            subtitle="Track teacher health and control account access."
            action={
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min={1}
                  value={addSlots}
                  onChange={(e) => setAddSlots(Math.max(1, Number(e.target.value || 1)))}
                  className="w-20 rounded-lg border border-[var(--border)] bg-[var(--card)] px-2 py-2 text-sm text-[var(--text-primary)] outline-none focus:border-violet-500"
                />
                <button
                  onClick={upgradeSlots}
                  disabled={slotUpgradeBusy}
                  className="rounded-lg border border-violet-200 bg-violet-50 px-3 py-2 text-xs font-semibold text-violet-700 hover:bg-violet-100 disabled:opacity-60"
                >
                  {slotUpgradeBusy ? "Updating..." : "Add slots"}
                </button>
              </div>
            }
          >
            <div className="overflow-x-auto">
              <table className="w-full min-w-[760px] text-sm">
                <thead>
                  <tr className="border-b border-[var(--border)] text-left text-xs uppercase tracking-wide text-[var(--text-tertiary)]">
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
                        <tr key={teacher.userId} className="border-b border-[var(--border)]">
                          <td className="py-3">
                            <div className="font-semibold text-[var(--text-primary)]">{teacher.name}</div>
                            <div className="text-xs text-[var(--text-tertiary)]">{teacher.email || teacher.userId}</div>
                          </td>
                          <td className="py-3">
                            <StatusPill status={teacher.status} />
                          </td>
                          <td className="py-3 text-[var(--text-secondary)]">{teacher.lessonsGenerated}</td>
                          <td className="py-3 text-[var(--text-secondary)]">{teacher.worksheetsCreated}</td>
                          <td className="py-3 text-[var(--text-secondary)]">{timeAgo(teacher.lastActiveAt)}</td>
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
                                  className="rounded-lg border border-[var(--border)] bg-[var(--card)] px-2.5 py-1.5 text-xs font-semibold text-[var(--text-secondary)] hover:bg-[var(--card-alt)] disabled:opacity-60"
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
                      <td colSpan={6} className="py-6 text-center text-sm text-[var(--text-tertiary)]">
                        No teachers yet. Share your school code so teachers can join.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </SectionCard>

          <SectionCard title="Activity monitoring" subtitle="Quick activity snapshots for the most recent teacher accounts.">
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              {dashboard.teachers.slice(0, 6).map((teacher) => (
                <div key={teacher.userId} className="rounded-xl border border-[var(--border)] bg-amber-50/60 p-3 dark:bg-amber-900/20">
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="font-semibold text-[var(--text-primary)]">{teacher.name}</div>
                      <div className="text-xs text-[var(--text-tertiary)]">{teacher.email || "No email"}</div>
                    </div>
                    <StatusPill status={teacher.status} />
                  </div>
                  <div className="mt-3 grid grid-cols-3 gap-2 text-center">
                    <div className="rounded-lg bg-[var(--card)] p-2">
                      <div className="text-[11px] text-[var(--text-tertiary)]">Lessons</div>
                      <div className="text-lg font-bold text-[var(--text-primary)]">{teacher.lessonsGenerated}</div>
                    </div>
                    <div className="rounded-lg bg-[var(--card)] p-2">
                      <div className="text-[11px] text-[var(--text-tertiary)]">Worksheets</div>
                      <div className="text-lg font-bold text-[var(--text-primary)]">{teacher.worksheetsCreated}</div>
                    </div>
                    <div className="rounded-lg bg-[var(--card)] p-2">
                      <div className="text-[11px] text-[var(--text-tertiary)]">Last active</div>
                      <div className="text-xs font-semibold text-[var(--text-primary)]">{timeAgo(teacher.lastActiveAt)}</div>
                    </div>
                  </div>
                </div>
              ))}
              {!dashboard.teachers.length ? (
                <div className="rounded-xl border border-[var(--border)] bg-[var(--card-alt)] p-4 text-sm text-[var(--text-secondary)]">
                  Activity cards will appear once teachers join your school code.
                </div>
              ) : null}
            </div>
          </SectionCard>
        </div>
      ) : null}
    </div>
  );
}