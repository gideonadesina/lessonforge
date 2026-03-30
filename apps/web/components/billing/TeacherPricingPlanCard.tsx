"use client";

import { type TeacherPlanConfig, estimateLessonPacks, formatNaira } from "@/lib/billing/pricing";

type TeacherPricingPlanCardProps = {
  plan: TeacherPlanConfig;
  onSelect: (planId: TeacherPlanConfig["id"]) => void;
  loading?: boolean;
};

export default function TeacherPricingPlanCard({
  plan,
  onSelect,
  loading = false,
}: TeacherPricingPlanCardProps) {
  const packs = estimateLessonPacks(plan.credits);

  return (
    <article
      className={[
        "relative flex h-full flex-col rounded-3xl border bg-white p-6 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md",
        plan.highlighted ? "border-violet-300 ring-1 ring-violet-200" : "border-slate-200",
      ].join(" ")}
    >
      {plan.highlighted ? (
        <span className="absolute right-4 top-4 rounded-full bg-violet-600 px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-white">
          Most Popular
        </span>
      ) : null}

      <div className="text-sm font-semibold text-slate-600">{plan.name}</div>
      <div className="mt-2 text-3xl font-extrabold tracking-tight text-slate-900">
        {formatNaira(plan.priceNaira)}
      </div>
      <p className="mt-3 text-sm text-slate-600">{plan.credits} credits included</p>
      <p className="mt-1 text-sm font-medium text-violet-700">Approx. {packs} lesson packs</p>

      <button
        type="button"
        onClick={() => onSelect(plan.id)}
        disabled={loading}
        className={[
          "mt-6 inline-flex w-full items-center justify-center rounded-2xl px-4 py-3 text-sm font-semibold transition",
          plan.highlighted
            ? "bg-violet-600 text-white hover:bg-violet-700"
            : "border border-slate-200 bg-white text-slate-900 hover:bg-slate-50",
          loading ? "cursor-not-allowed opacity-70" : "",
        ].join(" ")}
      >
        {loading ? "Preparing checkout..." : plan.ctaLabel}
      </button>
    </article>
  );
}
