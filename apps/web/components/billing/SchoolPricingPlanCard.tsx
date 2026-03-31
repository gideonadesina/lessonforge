"use client";

import { type SchoolPlanConfig, formatNaira } from "@/lib/billing/pricing";

type SchoolPricingPlanCardProps = {
  plan: SchoolPlanConfig;
  onSelect: (planId: SchoolPlanConfig["id"]) => void;
  loading?: boolean;
};

export default function SchoolPricingPlanCard({
  plan,
  onSelect,
  loading = false,
}: SchoolPricingPlanCardProps) {
  return (
    <article
      className={[
        "relative flex h-full flex-col rounded-3xl border bg-white p-6 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md",
        plan.highlighted ? "border-violet-300 ring-1 ring-violet-200" : "border-slate-200",
      ].join(" ")}
    >
      {plan.highlighted ? (
        <span className="absolute right-4 top-4 rounded-full bg-violet-600 px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-white">
          Recommended
        </span>
      ) : null}

      <div className="text-sm font-semibold text-slate-600">{plan.name}</div>
      <div className="mt-2 text-3xl font-extrabold tracking-tight text-slate-900">
        {formatNaira(plan.priceNaira)}
      </div>
      <p className="mt-1 text-xs text-slate-500">/month</p>

      <div className="mt-4 space-y-1 border-t border-slate-100 pt-4">
        <p className="text-sm text-slate-600">Up to {plan.teachers} teachers</p>
        <p className="text-sm text-slate-600">{plan.credits} shared credits/month</p>
        <p className="text-sm font-medium text-violet-700">Up to {plan.lessonPacks} Lesson Packs</p>
      </div>

      <div className="mt-6 flex-1 space-y-2 border-t border-slate-100 pt-4">
        {plan.features.map((feature) => (
          <div key={feature} className="flex items-start gap-2 text-xs text-slate-700">
            <span className="mt-1 inline-block h-1.5 w-1.5 flex-shrink-0 rounded-full bg-violet-600"></span>
            <span>{feature}</span>
          </div>
        ))}
      </div>

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
        {loading ? "Processing..." : plan.ctaLabel}
      </button>
    </article>
  );
}
