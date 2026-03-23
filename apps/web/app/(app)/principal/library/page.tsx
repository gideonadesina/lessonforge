"use client";

import Link from "next/link";
import { useEffect, useMemo } from "react";
import PrincipalPageHeader from "@/components/principal/PrincipalPageHeader";
import SectionCard from "@/components/principal/SectionCard";
import {
  PrincipalForbiddenState,
  PrincipalLoadingState,
  PrincipalOnboardingRequiredState,
} from "@/components/principal/PrincipalStates";
import { usePrincipalDashboard } from "@/lib/principal/client";

export default function PrincipalLibraryPage() {
  const { loading, forbidden, error, dashboard, onboardingRequired, loadDashboard } = usePrincipalDashboard();

  useEffect(() => {
    void loadDashboard();
  }, [loadDashboard]);

  const teacherContributions = useMemo(() => {
    if (!dashboard) return [];
    return [...dashboard.teachers]
      .map((teacher) => ({
        ...teacher,
        totalAssets: teacher.lessonsGenerated + teacher.worksheetsCreated,
      }))
      .sort((a, b) => b.totalAssets - a.totalAssets)
      .slice(0, 8);
  }, [dashboard]);

  if (loading) return <PrincipalLoadingState />;
  if (forbidden) return <PrincipalForbiddenState />;
  if (onboardingRequired) return <PrincipalOnboardingRequiredState />;

  return (
    <div className="space-y-5 rounded-3xl bg-amber-50/70 p-4 md:p-6">
      <PrincipalPageHeader
        eyebrow="Content Library"
        title="Principal Library"
        description="Track school content output and jump into the shared lesson library."
      />

      {error ? (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
      ) : null}

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-12">
        <div className="space-y-4 xl:col-span-8">
          <SectionCard
            title="School content inventory"
            subtitle="Teacher contribution snapshot across lessons and worksheets."
            action={
              <Link
                href="/library"
                className="rounded-lg bg-violet-600 px-3 py-2 text-xs font-semibold text-white hover:bg-violet-700"
              >
                Open full library
              </Link>
            }
          >
            <div className="overflow-x-auto">
              <table className="w-full min-w-[680px] text-sm">
                <thead>
                  <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-500">
                    <th className="py-2">Teacher</th>
                    <th className="py-2">Lessons</th>
                    <th className="py-2">Worksheets</th>
                    <th className="py-2 text-right">Total assets</th>
                  </tr>
                </thead>
                <tbody>
                  {teacherContributions.map((teacher) => (
                    <tr key={teacher.userId} className="border-b border-slate-100">
                      <td className="py-3">
                        <div className="font-semibold text-slate-900">{teacher.name}</div>
                        <div className="text-xs text-slate-500">{teacher.email || teacher.userId}</div>
                      </td>
                      <td className="py-3 text-slate-700">{teacher.lessonsGenerated}</td>
                      <td className="py-3 text-slate-700">{teacher.worksheetsCreated}</td>
                      <td className="py-3 text-right font-bold text-violet-700">{teacher.totalAssets}</td>
                    </tr>
                  ))}
                  {!teacherContributions.length ? (
                    <tr>
                      <td colSpan={4} className="py-6 text-center text-sm text-slate-500">
                        Contributions appear after teachers generate content.
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </SectionCard>
        </div>

        <aside className="space-y-4 xl:col-span-4">
          <SectionCard title="Library actions" subtitle="Navigate between production and review.">
            <div className="grid grid-cols-1 gap-2">
              <Link href="/principal/generate" className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-800 hover:bg-slate-50">
                Go to principal generate
              </Link>
              <Link href="/principal/analytics" className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-800 hover:bg-slate-50">
                Review analytics
              </Link>
              <Link href="/principal/planning" className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-800 hover:bg-slate-50">
                Open planning
              </Link>
            </div>
          </SectionCard>
        </aside>
      </div>
    </div>
  );
}