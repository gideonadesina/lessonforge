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
    <div className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-4 shadow-sm">
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1">
          <div className="text-xs font-semibold uppercase tracking-wide text-[var(--text-secondary)]">
            Credits
          </div>

          <div className="mt-3 flex items-baseline gap-2">
            <div className="text-2xl font-extrabold tracking-tight text-[var(--text-primary)]">
              {creditsRemaining}
            </div>
            <div className="text-sm text-[var(--text-secondary)]">/ {totalCredits}</div>
          </div>

          {/* Progress bar */}
          <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-[var(--border)]">
            <div
              className={`h-full transition-all duration-300 ${
                isLowCredits ? "bg-amber-500" : "bg-violet-600"
              }`}
              style={{ width: `${percentageUsed}%` }}
            />
          </div>

          <div className="mt-2 text-xs text-[var(--text-secondary)]">
            {lessonsRemaining} lessons remaining
          </div>

          {isLowCredits && (
            <div className="mt-2 inline-block rounded-full bg-amber-50 px-2 py-1 text-[11px] font-semibold text-amber-700">
              Running low
            </div>
          )}
        </div>
      </div>

      <div className="mt-4 border-t border-[var(--border)] pt-3">
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
