"use client";

import Link from "next/link";

type UsageAndPlanCardProps = {
  creditsRemaining: number;
  planLabel: string;
};

export default function UsageAndPlanCard({
  creditsRemaining,
  planLabel,
}: UsageAndPlanCardProps) {
  const lessonsRemaining = Math.max(0, Math.floor(creditsRemaining / 4));
  const isLowCredits = creditsRemaining > 0 && creditsRemaining <= 10;
  const percentageUsed = Math.min(100, Math.round((creditsRemaining / 200) * 100));

  return (
    <section className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-5 shadow-sm">
      <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
        {/* Left: Plan Info */}
        <div>
          <div className="text-xs font-semibold uppercase tracking-wide text-[var(--text-secondary)]">
            Plan
          </div>
          <div className="mt-2 text-2xl font-extrabold text-[var(--text-primary)]">
            {planLabel}
          </div>
          <Link
            href="/pricing"
            className="mt-2 text-sm font-semibold text-violet-700 transition hover:text-violet-800 dark:text-violet-400 dark:hover:text-violet-300"
          >
            See plans →
          </Link>
        </div>

        {/* Right: Credits & Usage */}
        <div>
          <div className="text-xs font-semibold uppercase tracking-wide text-[var(--text-secondary)]">
            Credits & Usage
          </div>
          <div className="mt-2">
            <div className="flex items-baseline gap-2">
              <div className="text-2xl font-extrabold text-[var(--text-primary)]">
                {creditsRemaining}
              </div>
              <div className="text-sm text-[var(--text-secondary)]">
                credits available
              </div>
            </div>

            {/* Progress Bar */}
            <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-[var(--border)]">
              <div
                className={`h-full transition-all ${
                  isLowCredits ? "bg-amber-500" : "bg-violet-600"
                }`}
                style={{ width: `${percentageUsed}%` }}
              />
            </div>

            <div className="mt-2 flex items-center justify-between">
              <div className="text-xs text-[var(--text-secondary)]">
                ~{lessonsRemaining} lesson packs remaining
              </div>
              {isLowCredits && (
                <div className="inline-block rounded-full bg-amber-50 px-2 py-1 text-[11px] font-semibold text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
                  Running low
                </div>
              )}
            </div>
          </div>

          {/* Soft CTA */}
          <Link
            href="/pricing"
            className="mt-3 block text-sm font-semibold text-violet-700 transition hover:text-violet-800 dark:text-violet-400 dark:hover:text-violet-300"
          >
            Upgrade for unlimited credits →
          </Link>
        </div>
      </div>
    </section>
  );
}
