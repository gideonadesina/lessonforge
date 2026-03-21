"use client";

import { useEffect, useState } from "react";
import PrincipalPageHeader from "@/components/principal/PrincipalPageHeader";
import SectionCard from "@/components/principal/SectionCard";
import {
  PrincipalForbiddenState,
  PrincipalLoadingState,
  PrincipalOnboardingRequiredState,
} from "@/components/principal/PrincipalStates";
import { formatDateOnly, getErrorMessage, usePrincipalDashboard } from "@/lib/principal/client";

export default function PrincipalWorkspacePage() {
  const { loading, forbidden, error, setError, dashboard, onboardingRequired, getToken, loadDashboard } =
    usePrincipalDashboard();
  const [codeBusy, setCodeBusy] = useState(false);

  useEffect(() => {
    void loadDashboard();
  }, [loadDashboard]);

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
    } catch (err: unknown) {
      setError(getErrorMessage(err, "Failed to regenerate code."));
    } finally {
      setCodeBusy(false);
    }
  }

  async function copySchoolCode(code: string) {
    try {
      await navigator.clipboard.writeText(code);
    } catch {
      setError("Copy failed. Please copy manually.");
    }
  }

  if (loading) return <PrincipalLoadingState />;
  if (forbidden) return <PrincipalForbiddenState />;
  if (onboardingRequired) return <PrincipalOnboardingRequiredState />;

  return (
    <div className="space-y-5 rounded-3xl bg-amber-50/70 p-4 md:p-6">
      <PrincipalPageHeader
        eyebrow="School Workspace"
        title="School Identity & Access"
        description="Manage school profile details and securely share teacher onboarding access."
      />

      {error ? (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
      ) : null}

      {dashboard ? (
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-12">
          <div className="space-y-4 xl:col-span-7">
            <SectionCard title="School profile" subtitle="Core workspace identity for your principal area.">
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                <div className="rounded-xl border border-slate-200 bg-white p-3">
                  <div className="text-xs uppercase tracking-wide text-slate-500">School name</div>
                  <div className="mt-1 text-sm font-bold text-slate-900">{dashboard.school.name}</div>
                </div>
                <div className="rounded-xl border border-slate-200 bg-white p-3">
                  <div className="text-xs uppercase tracking-wide text-slate-500">Principal name</div>
                  <div className="mt-1 text-sm font-bold text-slate-900">{dashboard.school.principalName || "—"}</div>
                </div>
                <div className="rounded-xl border border-slate-200 bg-white p-3">
                  <div className="text-xs uppercase tracking-wide text-slate-500">Workspace created</div>
                  <div className="mt-1 text-sm font-bold text-slate-900">{formatDateOnly(dashboard.school.createdAt)}</div>
                </div>
                <div className="rounded-xl border border-slate-200 bg-white p-3">
                  <div className="text-xs uppercase tracking-wide text-slate-500">School ID</div>
                  <div className="mt-1 break-all font-mono text-xs text-slate-700">{dashboard.school.id}</div>
                </div>
              </div>
            </SectionCard>

            <SectionCard title="Workspace guidance" subtitle="Share these instructions with your teaching team.">
              <ol className="list-decimal space-y-2 pl-5 text-sm text-slate-700">
                <li>Teachers sign in and join your school using the active school code.</li>
                <li>Monitor roster and engagement in the Teachers and Analytics pages.</li>
                <li>Regenerate code any time you need to rotate access security.</li>
              </ol>
            </SectionCard>
          </div>

          <aside className="space-y-4 xl:col-span-5">
            <SectionCard title="School code" subtitle="Use this code to onboard teachers to this workspace.">
              <div className="space-y-3">
                <div className="rounded-xl border border-violet-200 bg-violet-50 p-3">
                  <div className="text-xs uppercase tracking-wide text-violet-700">Active code</div>
                  <div className="mt-1 break-all font-mono text-2xl font-black tracking-wider text-slate-900">
                    {dashboard.school.code}
                  </div>
                </div>
                <div className="flex flex-col gap-2 sm:flex-row">
                  <button
                    onClick={() => copySchoolCode(dashboard.school.code)}
                    className="flex-1 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                  >
                    Copy code
                  </button>
                  <button
                    onClick={regenerateCode}
                    disabled={codeBusy}
                    className="flex-1 rounded-lg bg-violet-600 px-3 py-2 text-sm font-semibold text-white hover:bg-violet-700 disabled:opacity-60"
                  >
                    {codeBusy ? "Regenerating..." : "Regenerate code"}
                  </button>
                </div>
              </div>
            </SectionCard>
          </aside>
        </div>
      ) : null}
    </div>
  );
}
