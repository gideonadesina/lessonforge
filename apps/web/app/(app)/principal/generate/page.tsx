"use client";

import Link from "next/link";
import { useEffect } from "react";
import PrincipalPageHeader from "@/components/principal/PrincipalPageHeader";
import SectionCard from "@/components/principal/SectionCard";
import {
  PrincipalForbiddenState,
  PrincipalLoadingState,
  PrincipalOnboardingRequiredState,
} from "@/components/principal/PrincipalStates";
import { usePrincipalDashboard } from "@/lib/principal/client";

export default function PrincipalGeneratePage() {
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
        eyebrow="Generation Workspace"
        title="Principal Generate"
        description="Launch lesson-generation workflows and guide teacher output with clear school priorities."
      />

      {error ? (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
      ) : null}

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-12">
        <div className="space-y-4 xl:col-span-8">
          <SectionCard
            title="Generation control center"
            subtitle="Kick off content creation and keep outputs aligned with school goals."
            action={
              <Link
                href="/generate"
                className="rounded-lg bg-violet-600 px-3 py-2 text-xs font-semibold text-white hover:bg-violet-700"
              >
                Open Lesson Generator
              </Link>
            }
          >
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <div className="rounded-xl border border-slate-200 bg-white p-3 text-sm text-slate-700">
                Provide teachers with priority topics and weekly objectives before generation starts.
              </div>
              <div className="rounded-xl border border-slate-200 bg-white p-3 text-sm text-slate-700">
                Review generated volume in analytics and library pages to maintain quality standards.
              </div>
            </div>
          </SectionCard>
        </div>

        <aside className="space-y-4 xl:col-span-4">
          <SectionCard title="Quick route links" subtitle="Principal shortcuts for daily workflow.">
            <div className="grid grid-cols-1 gap-2">
              <Link href="/principal/library" className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-800 hover:bg-slate-50">
                Open principal library
              </Link>
              <Link href="/principal/teachers" className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-800 hover:bg-slate-50">
                Open teacher management
              </Link>
              <Link href="/principal/analytics" className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-800 hover:bg-slate-50">
                Open analytics
              </Link>
            </div>
          </SectionCard>

          {dashboard ? (
            <SectionCard title="School output summary" subtitle="Current production context.">
              <div className="space-y-2 text-sm text-slate-700">
                <div className="rounded-lg border border-slate-200 bg-white px-3 py-2">
                  Lessons generated: <span className="font-semibold text-slate-900">{dashboard.overview.totalLessonsGenerated}</span>
                </div>
                <div className="rounded-lg border border-slate-200 bg-white px-3 py-2">
                  Active teachers: <span className="font-semibold text-slate-900">{dashboard.overview.activeTeachers}</span>
                </div>
              </div>
            </SectionCard>
          ) : null}
        </aside>
      </div>
    </div>
  );
}
