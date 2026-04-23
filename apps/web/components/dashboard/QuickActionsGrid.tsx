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
    title: "Exam Builder",
    description:
      "Generate formal, timed, exam-standard papers with objective, theory, and marking guide sections.",
    href: "/exam-builder",
    tone: "emerald",
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
      return "bg-violet-50 border-violet-100 text-violet-700 dark:bg-violet-900/20 dark:border-violet-900 dark:text-violet-400";
    case "blue":
      return "bg-blue-50 border-blue-100 text-blue-700 dark:bg-blue-900/20 dark:border-blue-900 dark:text-blue-400";
    case "amber":
      return "bg-amber-50 border-amber-100 text-amber-700 dark:bg-amber-900/20 dark:border-amber-900 dark:text-amber-400";
    case "emerald":
      return "bg-emerald-50 border-emerald-100 text-emerald-700 dark:bg-emerald-900/20 dark:border-emerald-900 dark:text-emerald-400";
    case "pink":
      return "bg-pink-50 border-pink-100 text-pink-700 dark:bg-pink-900/20 dark:border-pink-900 dark:text-pink-400";
    default:
      return "bg-[var(--card-alt)] border-[var(--border)] text-[var(--text-secondary)]";
  }
}

export default function QuickActionsGrid() {
  return (
    <section className="rounded-[28px] border border-[var(--border)] bg-[var(--card)] p-5 text-[var(--text-primary)] shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold tracking-tight text-[var(--text-primary)]">
            Quick Actions
          </h2>
          <p className="mt-1 text-sm text-[var(--text-secondary)]">
            Move quickly through the most important parts of your teaching workflow.
          </p>
        </div>
      </div>

      <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {ACTIONS.map((action) => (
          <Link
            key={action.title}
            href={action.href}
            className="group rounded-2xl border border-[var(--border)] bg-[var(--card)] p-5 transition duration-200 hover:-translate-y-0.5 hover:bg-[var(--card-alt)] hover:shadow-md"
          >
            <div
              className={`inline-flex rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-wide ${toneClasses(
                action.tone
              )}`}
            >
              {action.title}
            </div>

            <div className="mt-4 text-base font-bold text-[var(--text-primary)] transition">
              {action.title}
            </div>

            <p className="mt-2 text-sm leading-relaxed text-[var(--text-secondary)]">
              {action.description}
            </p>

            <div className="mt-4 text-sm font-semibold text-violet-700 dark:text-violet-400">
              Open →
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}