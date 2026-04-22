"use client";

import { type TeacherPlanConfig, formatNaira } from "@/lib/billing/pricing";

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
  const planMeta: Record<TeacherPlanConfig["id"], { badge: string; accent: string }> = {
    basic: { badge: "Great start", accent: "#60A5FA" },
    pro: { badge: "Most Popular ⭐", accent: "#534AB7" },
    pro_plus: { badge: "Power Teacher", accent: "#7C3AED" },
    ultra_pro: { badge: "master teacher", accent: "#059669" },
  };
  const accent = planMeta[plan.id]?.accent ?? "#534AB7";
  const badge = planMeta[plan.id]?.badge ?? "Plan";

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
          Most teachers choose this
        </span>
      ) : null}

      <div className="flex items-center justify-between gap-2">
        <div
          className="text-sm font-bold text-[#1E1B4B]"
          style={{ fontFamily: '"Trebuchet MS", sans-serif' }}
        >
          {plan.name}
        </div>
        <span
          className="rounded-[100px] px-3 py-1 text-[11px]"
          style={{
            fontFamily: '"Trebuchet MS", sans-serif',
            background: `${accent}20`,
            color: accent,
          }}
        >
          {badge}
        </span>
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
          {plan.credits} credits (~{plan.lessonPacks} lesson packs)
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
        {loading ? "Preparing checkout..." : `Upgrade to ${plan.name} →`}
      </button>
    </article>
  );
}
