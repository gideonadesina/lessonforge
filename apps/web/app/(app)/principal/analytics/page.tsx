"use client";

import { useEffect, useMemo } from "react";
import MetricCard from "@/components/principal/MetricCard";
import PrincipalPageHeader from "@/components/principal/PrincipalPageHeader";
import SectionCard from "@/components/principal/SectionCard";
import StatusPill from "@/components/principal/StatusPill";
import {
  PrincipalForbiddenState,
  PrincipalLoadingState,
  PrincipalOnboardingRequiredState,
} from "@/components/principal/PrincipalStates";
import { timeAgo, usePrincipalDashboard } from "@/lib/principal/client";

export default function PrincipalAnalyticsPage() {
  const { loading, forbidden, error, dashboard, onboardingRequired, loadDashboard } = usePrincipalDashboard();

  useEffect(() => {
    void loadDashboard();
  }, [loadDashboard]);

  const topTeachers = useMemo(() => {
    if (!dashboard) return [];
    return [...dashboard.teachers]
      .sort((a, b) => b.lessonsGenerated + b.worksheetsCreated - (a.lessonsGenerated + a.worksheetsCreated))
      .slice(0, 8);
  }, [dashboard]);

  if (loading) return <PrincipalLoadingState />;
  if (forbidden) return <PrincipalForbiddenState />;
  if (onboardingRequired) return <PrincipalOnboardingRequiredState />;

  return (
    <div className="space-y-5 rounded-3xl bg-amber-50/70 p-4 md:p-6">
      <PrincipalPageHeader
        eyebrow="School Analytics"
        title="Performance & Engagement Analytics"
        description="Track usage trends and compare teacher output to guide coaching and resource allocation."
      />

      {error ? (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
      ) : null}

      {dashboard ? (
        <div className="space-y-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <MetricCard title="Lessons generated" value={dashboard.overview.totalLessonsGenerated} subtitle="All-time school output" />
            <MetricCard title="Weekly events" value={dashboard.overview.weeklyActivityCount} subtitle="Activity in last 7 days" />
            <MetricCard title="Active teachers" value={dashboard.overview.activeTeachers} subtitle="Currently active accounts" />
            <MetricCard title="Teacher count" value={dashboard.overview.totalTeachers} subtitle="Total teacher members" />
          </div>

          <div className="grid grid-cols-1 gap-4 xl:grid-cols-12">
            <div className="space-y-4 xl:col-span-8">
              <SectionCard title="Teacher performance leaderboard" subtitle="Top contributors by lessons and worksheets created.">
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[700px] text-sm">
                    <thead>
                      <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-500">
                        <th className="py-2">Teacher</th>
                        <th className="py-2">Status</th>
                        <th className="py-2">Lessons</th>
                        <th className="py-2">Worksheets</th>
                        <th className="py-2">Last active</th>
                        <th className="py-2 text-right">Total output</th>
                      </tr>
                    </thead>
                    <tbody>
                      {topTeachers.map((teacher) => (
                        <tr key={teacher.userId} className="border-b border-slate-100">
                          <td className="py-3">
                            <div className="font-semibold text-slate-900">{teacher.name}</div>
                            <div className="text-xs text-slate-500">{teacher.email || teacher.userId}</div>
                          </td>
                          <td className="py-3">
                            <StatusPill status={teacher.status} />
                          </td>
                          <td className="py-3">{teacher.lessonsGenerated}</td>
                          <td className="py-3">{teacher.worksheetsCreated}</td>
                          <td className="py-3">{timeAgo(teacher.lastActiveAt)}</td>
                          <td className="py-3 text-right font-bold text-violet-700">
                            {teacher.lessonsGenerated + teacher.worksheetsCreated}
                          </td>
                        </tr>
                      ))}
                      {!topTeachers.length ? (
                        <tr>
                          <td colSpan={6} className="py-6 text-center text-sm text-slate-500">
                            Analytics will appear after teacher activity starts.
                          </td>
                        </tr>
                      ) : null}
                    </tbody>
                  </table>
                </div>
              </SectionCard>
            </div>

            <aside className="space-y-4 xl:col-span-4">
              <SectionCard title="Operational insights" subtitle="Simple alerts for principal decision making.">
                <div className="space-y-2 text-sm text-slate-700">
                  <div className="rounded-xl border border-slate-200 bg-white px-3 py-2">
                    Activity velocity:{" "}
                    <span className="font-semibold text-slate-900">
                      {dashboard.overview.weeklyActivityCount >= 10 ? "Healthy" : "Needs attention"}
                    </span>
                  </div>
                  <div className="rounded-xl border border-slate-200 bg-white px-3 py-2">
                    Capacity utilization:{" "}
                    <span className="font-semibold text-slate-900">
                      {Math.min(
                        100,
                        Math.round((dashboard.overview.totalTeachers / Math.max(dashboard.subscription.slotLimit, 1)) * 100)
                      )}
                      %
                    </span>
                  </div>
                  <div className="rounded-xl border border-slate-200 bg-white px-3 py-2">
                    Planning completion:{" "}
                    <span className="font-semibold text-slate-900">{dashboard.planning.schemeProgressPercent}%</span>
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
