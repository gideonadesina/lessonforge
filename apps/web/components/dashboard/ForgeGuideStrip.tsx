"use client";

import { useEffect, useState } from "react";

const FORGEGUIDE_STRIPS = [
  {
    label: "Teaching Insight",
    text: "Clarity in instruction builds confidence in learners.",
    subtext: "Today, simplify one key idea deeply rather than rushing through many points.",
  },
  {
    label: "Global Teaching Pulse",
    text: "Student-centred and activity-based learning continues to grow across classrooms worldwide.",
    subtext: "Use more discussion, participation, reflection, and practical engagement where possible.",
  },
  {
    label: "Teacher Reminder",
    text: "A well-guided lesson can shape a student’s future more than you may realize.",
    subtext: "Teach with calm, structure, and confidence today.",
  },
  {
    label: "Classroom Strategy",
    text: "Learners retain more when they explain, apply, and discuss what they have learned.",
    subtext: "Add one short recap question or peer explanation moment to your lesson.",
  },
  {
    label: "Teaching Reflection",
    text: "Strong teaching is not only about content — it is also about connection.",
    subtext: "Look for one moment today to check whether students truly understand.",
  },
];

export default function ForgeGuideStrip() {
  const [activeIndex, setActiveIndex] = useState(0);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setActiveIndex((prev) => (prev + 1) % FORGEGUIDE_STRIPS.length);
    }, 300000); // 5 minutes

    return () => window.clearInterval(timer);
  }, []);

  const active = FORGEGUIDE_STRIPS[activeIndex];

  return (
    <section className="rounded-[24px] border border-slate-200 bg-white px-5 py-4 shadow-sm bg-white dark:bg-[#0B1530] border-slate-200 dark:border-[#1A2847]">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-bold tracking-tight text-slate-900 dark:text-white">
              ForgeGuide
            </span>
            <span className="rounded-full bg-violet-50 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-violet-700 dark:bg-violet-900/30 dark:text-violet-400">
              {active.label}
            </span>
          </div>

          <div className="mt-2 transition-opacity duration-500">
            <p className="text-sm font-semibold italic leading-relaxed text-slate-800 dark:text-slate-200 sm:text-base">
              "{active.text}"
            </p>
            <p className="mt-1 text-sm leading-relaxed text-slate-600 dark:text-slate-400">
              {active.subtext}
            </p>
          </div>
        </div>

        <div className="shrink-0">
        </div>
      </div>
    </section>
  );
}