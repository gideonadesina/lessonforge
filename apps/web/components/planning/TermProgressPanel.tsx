"use client";

import type { TermProgress } from "@/lib/planning/types";

function barColorForSubject(subject: string) {
  const normalized = subject.trim().toLowerCase();
  if (normalized.includes("physics")) return "#534AB7";
  if (normalized.includes("chemistry")) return "#639922";
  if (normalized.includes("math")) return "#BA7517";
  return "#64748b";
}

export default function TermProgressPanel({
  progress,
  loading,
  error,
}: {
  progress: TermProgress;
  loading: boolean;
  error: string | null;
}) {
  const subjects = progress.subjects ?? [];
  const totalDone = subjects.reduce((sum, subject) => sum + subject.done, 0);
  const totalTopics = subjects.reduce((sum, subject) => sum + subject.total, 0);
  const totalBehind = subjects.reduce((sum, subject) => sum + subject.behind, 0);

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-4">
      <h3 className="text-sm font-semibold text-slate-900">Term progress</h3>
      {error ? <p className="mt-1 text-xs text-rose-700">{error}</p> : null}

      {loading ? (
        <div className="mt-3 space-y-2">
          <div className="h-16 animate-pulse rounded-xl bg-slate-100" />
          <div className="h-16 animate-pulse rounded-xl bg-slate-100" />
        </div>
      ) : (
        <>
          <div className="mt-3 grid grid-cols-1 gap-2 md:grid-cols-3">
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
              <div className="text-[11px] text-slate-600">Current week</div>
              <div className="mt-1 text-lg font-semibold text-slate-900">
                {progress.week_number ?? "-"}
              </div>
            </div>

            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
              <div className="text-[11px] text-slate-600">Topics completed</div>
              <div className="mt-1 text-lg font-semibold text-slate-900">
                {totalDone}/{totalTopics}
              </div>
            </div>

            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
              <div className="text-[11px] text-slate-600">Topics behind</div>
              <div
                className={`mt-1 text-lg font-semibold ${
                  totalBehind > 0 ? "text-rose-600" : "text-slate-900"
                }`}
              >
                {totalBehind}
              </div>
            </div>
          </div>

          <div className="mt-4 space-y-3">
            {subjects.length === 0 ? (
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs text-slate-600">
                No scheme entries found yet.
              </div>
            ) : (
              subjects.map((subject) => (
                <div key={subject.subject} className="flex items-center gap-3">
                  <div className="w-28 text-xs font-medium text-slate-700">
                    {subject.subject}
                  </div>
                  <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-100">
                    <div
                      className="h-full rounded-full"
                      style={{
                        width: `${Math.max(0, Math.min(100, subject.percent))}%`,
                        backgroundColor: barColorForSubject(subject.subject),
                      }}
                    />
                  </div>
                  <div className="w-10 text-right text-xs text-slate-700">
                    {subject.percent}%
                  </div>
                </div>
              ))
            )}
          </div>
        </>
      )}
    </section>
  );
}
