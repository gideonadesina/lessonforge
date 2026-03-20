"use client";

import { useEffect, useState } from "react";

const FORGEGUIDE_INSIGHTS = [
  {
    type: "Teaching Quote",
    text: "A good teacher does not only explain — a good teacher awakens understanding.",
    subtext: "Today, aim for clarity over complexity.",
  },
  {
    type: "Teaching Quote",
    text: "Clarity in teaching builds confidence in learners.",
    subtext: "Break ideas into smaller steps your learners can follow.",
  },
  {
    type: "Teaching Insight",
    text: "The best lessons are not only taught, they are experienced.",
    subtext: "Use examples, demonstrations, and active participation where possible.",
  },
  {
    type: "Teaching Insight",
    text: "Patience and preparation make teaching powerful.",
    subtext: "Even a simple, well-prepared lesson can make a lasting impact.",
  },
  {
    type: "Global Teaching Pulse",
    text: "Around the world, teachers are using more student-centred and activity-based methods.",
    subtext: "Think discussion, participation, reflection, and practical engagement.",
  },
  {
    type: "Global Teaching Pulse",
    text: "AI-assisted lesson preparation is growing, but teachers still remain the heart of effective learning.",
    subtext: "Technology supports teaching — it does not replace your wisdom in the classroom.",
  },
];

type ForgeGuideWelcomeCardProps = {
  teacherName?: string | null;
  onOpen?: () => void;
};

export default function ForgeGuideWelcomeCard({
  teacherName,
  onOpen,
}: ForgeGuideWelcomeCardProps) {
  const displayName = teacherName?.trim() || "Teacher";
  const [activeIndex, setActiveIndex] = useState(0);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setActiveIndex((prev) => (prev + 1) % FORGEGUIDE_INSIGHTS.length);
    }, 300000);

    return () => window.clearInterval(timer);
  }, []);

  const active = FORGEGUIDE_INSIGHTS[activeIndex];

  return (
    <div className="rounded-2xl border border-slate-200 bg-white px-4 py-4 shadow-sm">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-lg font-bold tracking-tight text-slate-900">
              ForgeGuide
            </h2>
          </div>

          <p className="mt-1 text-xs font-medium uppercase tracking-wide text-slate-500">
            {active.type}
          </p>

          <div className="mt-2 transition-opacity duration-500">
            <p className="text-sm font-semibold italic leading-relaxed text-slate-800">
              “{active.text}”
            </p>

            <p className="mt-2 text-sm leading-relaxed text-slate-600">
              Welcome back, {displayName}. {active.subtext}
            </p>
          </div>
        </div>

        {onOpen ? (
          <button
            type="button"
            onClick={onOpen}
            className="shrink-0 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-800 hover:bg-slate-50"
          >
            Open ForgeGuide
          </button>
        ) : null}
      </div>
    </div>
  );
}