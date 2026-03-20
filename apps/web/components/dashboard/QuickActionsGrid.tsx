"use client";

import Link from "next/link";

const ACTIONS = [
  {
    title: "Generate Lesson",
    description:
      "Create lesson plans, notes, slides, quizzes, and references in minutes.",
    href: "/generate",
    tone: "violet",
  },
  {
    title: "Worksheets",
    description:
      "Build classwork, homework, revision sheets, quizzes, and test practice in one place.",
    href: "/worksheets",
    tone: "blue",
  },
  {
    title: "Open Library",
    description:
      "Review, reuse, and organize your saved lessons and teaching resources.",
    href: "/library",
    tone: "slate",
  },
  {
    title: "Planning Setup",
    description:
      "Manage scheme of work, calendar, and school planning structure.",
    href: "/planning",
    tone: "emerald",
  },
  {
    title: "School Settings",
    description:
      "Configure school-wide teaching workflows, preferences, and access.",
    href: "/school",
    tone: "pink",
  },
  {
    title: "Teaching Insights",
    description:
      "See your workflow trends, planning readiness, and smart teaching guidance.",
    href: "/dashboard",
    tone: "amber",
  },
] as const;

function toneClasses(tone: string) {
  switch (tone) {
    case "violet":
      return "bg-violet-50 border-violet-100 text-violet-700";
    case "blue":
      return "bg-blue-50 border-blue-100 text-blue-700";
    case "amber":
      return "bg-amber-50 border-amber-100 text-amber-700";
    case "emerald":
      return "bg-emerald-50 border-emerald-100 text-emerald-700";
    case "pink":
      return "bg-pink-50 border-pink-100 text-pink-700";
    default:
      return "bg-slate-50 border-slate-100 text-slate-700";
  }
}

export default function QuickActionsGrid() {
  return (
    <section className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold tracking-tight text-slate-900">
            Quick Actions
          </h2>
          <p className="mt-1 text-sm text-slate-600">
            Move quickly through the most important parts of your teaching workflow.
          </p>
        </div>
      </div>

      <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {ACTIONS.map((action) => (
          <Link
            key={action.title}
            href={action.href}
            className="group rounded-2xl border border-slate-200 bg-white p-5 transition duration-200 hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-md"
          >
            <div
              className={`inline-flex rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-wide ${toneClasses(
                action.tone
              )}`}
            >
              {action.title}
            </div>

            <div className="mt-4 text-base font-bold text-slate-900 transition group-hover:text-slate-950">
              {action.title}
            </div>

            <p className="mt-2 text-sm leading-relaxed text-slate-600">
              {action.description}
            </p>

            <div className="mt-4 text-sm font-semibold text-violet-700">
              Open →
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}