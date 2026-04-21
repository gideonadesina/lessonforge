"use client";

import Link from "next/link";

type CreditsCardProps = {
  creditsRemaining: number;
  totalCredits?: number;
  planLabel: string;
  isLowCredits?: boolean;
};

export default function CreditsCard({
  creditsRemaining,
  totalCredits = 200,
  planLabel,
  isLowCredits = false,
}: CreditsCardProps) {
  const percentageUsed = Math.round((creditsRemaining / totalCredits) * 100);
  const lessonsRemaining = Math.max(0, Math.floor(creditsRemaining / 1));

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-200 dark:border-[#1A2847] bg-white dark:bg-[#0B1530]">
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1">
          <div className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
            Credits
          </div>

          <div className="mt-3 flex items-baseline gap-2">
            <div className="text-2xl font-extrabold tracking-tight text-slate-900 dark:text-white">
              {creditsRemaining}
            </div>
            <div className="text-sm text-slate-500">/ {totalCredits}</div>
          </div>

          {/* Progress bar */}
          <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-slate-200 dark:bg-[#1A2847]">
            <div
              className={`h-full transition-all duration-300 ${
                isLowCredits ? "bg-amber-500" : "bg-violet-600"
              }`}
              style={{ width: `${percentageUsed}%` }}
            />
          </div>

          <div className="mt-2 text-xs text-slate-600 dark:text-slate-400">
            {lessonsRemaining} lessons remaining
          </div>

          {isLowCredits && (
            <div className="mt-2 inline-block rounded-full bg-amber-50 px-2 py-1 text-[11px] font-semibold text-amber-700">
              Running low
            </div>
          )}
        </div>
      </div>

      <div className="mt-4 border-t border-slate-200 pt-3 dark:border-slate-200 dark:border-[#1A2847]">
        <Link
          href="/pricing"
          className="text-xs font-semibold text-violet-700 transition hover:text-violet-800"
        >
          Upgrade for unlimited credits →
        </Link>
      </div>
    </div>
  );
}
