"use client";

import { type SchoolPlanConfig, formatNaira } from "@/lib/billing/pricing";

type SchoolPricingPlanCardProps = {
  plan: SchoolPlanConfig;
  onSelect: (planId: SchoolPlanConfig["id"]) => void;
  loading?: boolean;
  packLabel?: "lesson packs" | "resource packs";
};

export default function SchoolPricingPlanCard({
  plan,
  onSelect,
  loading = false,
  packLabel = "lesson packs",
}: SchoolPricingPlanCardProps) {
  const accentByPlan: Record<SchoolPlanConfig["id"], string> = {
    school_starter: "#60A5FA",
    school_growth: "#534AB7",
    school_full: "#7C3AED",
    school_enterprise: "#059669",
  };
  const accent = accentByPlan[plan.id] ?? "#534AB7";

  return (
    <article
      className={[
        "relative flex h-full flex-col rounded-[20px] border bg-white p-6 shadow-[0_4px_24px_rgba(83,74,183,0.08)] transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_10px_30px_rgba(83,74,183,0.14)]",
        plan.highlighted
          ? "scale-[1.02] border-[#534AB7] ring-1 ring-[rgba(83,74,183,0.2)]"
          : "border-[#E2E8F0]",
      ].join(" ")}
    >
      {plan.highlighted ? (
        <span
          className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-[100px] bg-gradient-to-r from-[#534AB7] to-[#3D35A0] px-3 py-1 text-[10px] uppercase text-white"
          style={{ fontFamily: '"Trebuchet MS", sans-serif', letterSpacing: "2.5px" }}
        >
          Most schools choose this
        </span>
      ) : null}

      <div className="flex items-center justify-between gap-2">
        <div
          className="text-sm font-bold text-[#1E1B4B]"
          style={{ fontFamily: '"Trebuchet MS", sans-serif' }}
        >
          {plan.name}
        </div>
      </div>
      <div
        className="mt-2 text-4xl font-bold tracking-tight text-[#1E1B4B]"
        style={{ fontFamily: '"Playfair Display", Georgia, serif' }}
      >
        {formatNaira(plan.priceNaira)}
      </div>
      <p
        className="mt-1 text-xs text-[#475569]"
        style={{ fontFamily: '"Trebuchet MS", sans-serif' }}
      >
        /month
      </p>

      <div className="mt-4 space-y-1 border-t border-[#E2E8F0] pt-4">
        <p className="text-sm text-[#475569]" style={{ fontFamily: '"Trebuchet MS", sans-serif' }}>
          Up to {plan.teachers} teachers
        </p>
        <p className="text-sm text-[#475569]" style={{ fontFamily: '"Trebuchet MS", sans-serif' }}>
          {plan.credits} shared credits/month
        </p>
        <p className="text-sm font-medium" style={{ fontFamily: '"Trebuchet MS", sans-serif', color: accent }}>
          Up to {plan.lessonPacks} {packLabel}
        </p>
      </div>

      <div className="mt-6 flex-1 space-y-2 border-t border-[#E2E8F0] pt-4">
        {plan.features.map((feature) => (
          <div key={feature} className="flex items-start gap-2 text-xs text-[#475569]">
            <span
              className="mt-1 inline-block h-1.5 w-1.5 flex-shrink-0 rounded-full"
              style={{ backgroundColor: accent }}
            />
            <span style={{ fontFamily: '"Trebuchet MS", sans-serif' }}>{feature}</span>
          </div>
        ))}
      </div>

      <button
        type="button"
        onClick={() => onSelect(plan.id)}
        disabled={loading}
        className={[
          "mt-6 inline-flex w-full items-center justify-center rounded-[12px] px-4 py-[13px] text-sm font-bold transition-all duration-200",
          plan.highlighted
            ? "bg-gradient-to-br from-[#534AB7] to-[#3D35A0] text-white shadow-[0_4px_16px_rgba(83,74,183,0.35)] hover:-translate-y-[1px] hover:shadow-[0_6px_18px_rgba(83,74,183,0.4)]"
            : "border-[1.5px] border-[#534AB7] bg-transparent text-[#534AB7] hover:bg-[#EEEDFE]",
          loading ? "cursor-not-allowed opacity-70" : "",
        ].join(" ")}
        style={{ fontFamily: '"Trebuchet MS", sans-serif' }}
      >
        {loading ? "Processing..." : `Upgrade to ${plan.name} →`}
      </button>
    </article>
  );
}
