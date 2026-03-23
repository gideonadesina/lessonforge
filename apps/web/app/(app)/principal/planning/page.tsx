"use client";

import Link from "next/link";
import { useEffect } from "react";
import MetricCard from "@/components/principal/MetricCard";
import PrincipalPageHeader from "@/components/principal/PrincipalPageHeader";
import SectionCard from "@/components/principal/SectionCard";
import {
  PrincipalForbiddenState,
  PrincipalLoadingState,
  PrincipalOnboardingRequiredState,
} from "@/components/principal/PrincipalStates";
import { usePrincipalDashboard } from "@/lib/principal/client";

export default function PrincipalPlanningPage() {
  const { loading, forbidden, error, dashboard, onboardingRequired, loadDashboard } = usePrincipalDashboard();

  useEffect(() => {
    void loadDashboard();
  }, [loadDashboard]);

  if (loading) return <PrincipalLoadingState />;
  if (forbidden) return <PrincipalForbiddenState />;
  if (onboardingRequired) return <PrincipalOnboardingRequiredState />;

  return (
    <div className="space-y-5 rounded-3xl bg-amber-50/70 p-4 md:p-6">
      <PrincipalPageHeader
        eyebrow="Academic Planning"
        title="Planning Oversight"
        description="Track school-wide planning execution, progress milestones, and upcoming events."
      />

      {error ? (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
      ) : null}

      {dashboard ? (
        <div className="space-y-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <MetricCard title="Scheme progress" value={`${dashboard.planning.schemeProgressPercent}%`} subtitle="Overall completion signal" />
            <MetricCard
              title="Completed milestones"
              value={dashboard.planning.completedSchemeMilestones}
              subtitle={`Out of ${dashboard.planning.totalSchemeMilestones}`}
            />
            <MetricCard title="Upcoming events" value={dashboard.planning.upcomingAcademicEvents.length} subtitle="Planned academic activities" />
            <MetricCard title="Weekly activity" value={dashboard.overview.weeklyActivityCount} subtitle="Usage signal from teachers" />
          </div>

          <div className="grid grid-cols-1 gap-4 xl:grid-cols-12">
            <div className="space-y-4 xl:col-span-7">
              <SectionCard title="Milestone progress" subtitle="Visual progress against current scheme milestones.">
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
              </SectionCard>

              <SectionCard
                title="Principal planning actions"
                subtitle="Use these tools to drive school-wide consistency."
                action={
                  <Link
                    href="/planning"
                    className="rounded-lg border border-violet-200 bg-violet-50 px-3 py-2 text-xs font-semibold text-violet-700 hover:bg-violet-100"
                  >
                    Open teacher planning workspace
                  </Link>
                }
              >
                <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                  <div className="rounded-xl border border-slate-200 bg-white p-3 text-sm text-slate-700">
                    Review upcoming events and identify staffing conflicts before deadlines.
                  </div>
                  <div className="rounded-xl border border-slate-200 bg-white p-3 text-sm text-slate-700">
                    Monitor completion pace and nudge teams when milestone progress slows.
                  </div>
                </div>
              </SectionCard>
            </div>

            <aside className="space-y-4 xl:col-span-5">
              <SectionCard title="Upcoming academic events" subtitle="Events surfaced from planning data.">
                <div className="space-y-2">
                  {dashboard.planning.upcomingAcademicEvents.map((event) => (
                    <div key={event.id} className="flex items-center justify-between rounded-lg border border-slate-200 bg-white px-3 py-2">
                      <div>
                        <div className="text-sm font-semibold text-slate-900">{event.title}</div>
                        <div className="text-xs uppercase tracking-wide text-slate-500">{event.category}</div>
                      </div>
                      <div className="text-xs font-semibold text-slate-600">{event.startsAt}</div>
                    </div>
                  ))}
                  {!dashboard.planning.upcomingAcademicEvents.length ? (
                    <div className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-600">
                      No upcoming events yet.
                    </div>
                  ) : null}
                </div>
              </SectionCard>
            </aside>
          </div>
        </div>
      ) : null}
    </div>
  );
}