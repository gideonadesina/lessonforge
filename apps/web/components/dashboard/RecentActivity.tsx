"use client";

import Link from "next/link";

type LessonRow = {
  id: string;
  subject: string | null;
  topic: string | null;
  grade: string | null;
  curriculum: string | null;
  created_at: string;
};

type RecentActivityProps = {
  loading?: boolean;
  lessons?: LessonRow[];
  deletingId?: string | null;
  onDelete?: (id: string) => void;
  formatDate: (iso: string) => string;
  relativeTime: (iso: string) => string;
};

export default function RecentActivity({
  loading = false,
  lessons = [],
  deletingId = null,
  onDelete,
  formatDate,
  relativeTime,
}: RecentActivityProps) {
  return (
    <section className="rounded-[28px] border border-[var(--border)] bg-[var(--card)] p-5 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold tracking-tight text-[var(--text-primary)]">
            Recent Lesson Packs
          </h2>
          <p className="mt-1 text-sm text-[var(--text-secondary)]">
            Quick access to your latest generated teaching resources.
          </p>
        </div>

        <Link
          href="/library"
          className="text-sm font-semibold text-violet-700 transition hover:text-violet-800 dark:text-violet-400 dark:hover:text-violet-300"
        >
          View all →
        </Link>
      </div>

      <div className="mt-5 overflow-x-auto">
        <table className="w-full min-w-[640px] text-sm">
          <thead>
            <tr className="border-b border-[var(--border)] text-left text-xs uppercase tracking-wide text-[var(--text-tertiary)]">
              <th className="py-3 pr-3 font-semibold">Topic</th>
              <th className="py-3 pr-3 font-semibold">Subject</th>
              <th className="py-3 pr-3 font-semibold">Class</th>
              <th className="py-3 pr-3 font-semibold">Created</th>
              <th className="py-3 text-right font-semibold">Actions</th>
            </tr>
          </thead>

          <tbody>
            {loading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <tr key={i} className="border-b border-[var(--border)]">
                  <td className="py-4 pr-3">
                    <div className="h-4 w-40 rounded bg-[var(--border)]" />
                  </td>
                  <td className="py-4 pr-3">
                    <div className="h-4 w-24 rounded bg-[var(--border)]" />
                  </td>
                  <td className="py-4 pr-3">
                    <div className="h-4 w-16 rounded bg-[var(--border)]" />
                  </td>
                  <td className="py-4 pr-3">
                    <div className="h-4 w-20 rounded bg-[var(--border)]" />
                  </td>
                  <td className="py-4 text-right">
                    <div className="ml-auto h-8 w-28 rounded-xl bg-[var(--border)]" />
                  </td>
                </tr>
              ))
            ) : lessons.length === 0 ? (
              <tr>
                <td colSpan={5} className="py-10 text-center text-sm text-[var(--text-secondary)]">
                  No lessons yet. Start by generating your first lesson pack.
                </td>
              </tr>
            ) : (
              lessons.map((lesson) => (
                <tr key={lesson.id} className="border-b border-[var(--border)] last:border-b-0">
                  <td className="py-4 pr-3">
                    <div className="font-semibold text-[var(--text-primary)]">
                      {lesson.topic || "Untitled topic"}
                    </div>
                    {lesson.curriculum ? (
                      <div className="mt-1 text-xs text-[var(--text-secondary)]">
                        {lesson.curriculum}
                      </div>
                    ) : null}
                  </td>

                  <td className="py-4 pr-3">
                    <span className="inline-flex rounded-full border border-indigo-100 bg-indigo-50 px-2.5 py-1 text-xs font-semibold text-indigo-700 dark:border-indigo-900/50 dark:bg-indigo-900/30 dark:text-indigo-400">
                      {lesson.subject || "Subject"}
                    </span>
                  </td>

                  <td className="py-4 pr-3 text-[var(--text-secondary)]">
                    {lesson.grade || "—"}
                  </td>

                  <td
                    className="py-4 pr-3 text-[var(--text-secondary)]"
                    title={formatDate(lesson.created_at)}
                  >
                    {relativeTime(lesson.created_at)}
                  </td>

                  <td className="py-4 text-right">
                    <div className="inline-flex gap-2">
                      <Link
                        href={`/lesson/${lesson.id}`}
                        className="rounded-xl border border-[var(--border)] bg-[var(--card)] px-3 py-2 text-xs font-semibold text-[var(--text-primary)] transition hover:bg-[var(--card-alt)]"
                      >
                        View
                      </Link>

                      <button
                        type="button"
                        onClick={() => onDelete?.(lesson.id)}
                        disabled={deletingId === lesson.id}
                        className="rounded-xl border border-[var(--border)] bg-[var(--card)] px-3 py-2 text-xs font-semibold text-red-700 transition hover:bg-red-50 disabled:opacity-60 dark:text-red-400 dark:hover:bg-red-900/20"
                      >
                        {deletingId === lesson.id ? "Deleting…" : "Delete"}
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}