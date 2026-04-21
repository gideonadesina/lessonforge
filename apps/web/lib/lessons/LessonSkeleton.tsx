/**
 * LessonSkeleton - A clean, polished loading placeholder for lesson content.
 * Shows:
 * - Title/header skeleton
 * - Lesson sections as skeleton cards
 * Copy: "Opening lesson pack..."
 *
 * This creates a premium perceived experience by showing the structure
 * while content is still being loaded.
 */

export function LessonSkeleton() {
  return (
    <div className="space-y-6 animate-pulse">
      {/* Meta header skeleton */}
      <div className="rounded-2xl border border-slate-200 bg-white p-4 space-y-3">
        <div className="h-3 w-24 rounded bg-slate-200" />
        <div className="h-8 w-3/4 rounded bg-slate-200" />
        <div className="h-4 w-1/2 rounded bg-slate-200" />
      </div>

      {/* Lesson Plan section skeleton */}
      <section className="rounded-2xl border border-slate-200 bg-white p-4 space-y-4">
        <div className="h-5 w-32 rounded bg-slate-200" />

        {/* Title field */}
        <div className="space-y-2">
          <div className="h-3 w-16 rounded bg-slate-200" />
          <div className="h-4 w-full rounded bg-slate-200" />
          <div className="h-4 w-5/6 rounded bg-slate-200" />
        </div>

        {/* Objectives field */}
        <div className="space-y-2">
          <div className="h-3 w-36 rounded bg-slate-200" />
          <div className="h-4 w-full rounded bg-slate-200" />
          <div className="h-4 w-full rounded bg-slate-200" />
          <div className="h-4 w-4/5 rounded bg-slate-200" />
        </div>

        {/* Materials field */}
        <div className="space-y-2">
          <div className="h-3 w-32 rounded bg-slate-200" />
          <div className="h-4 w-full rounded bg-slate-200" />
          <div className="h-4 w-5/6 rounded bg-slate-200" />
        </div>
      </section>

      {/* Lesson Notes section skeleton */}
      <section className="rounded-2xl border border-slate-200 bg-white p-4 space-y-4">
        <div className="h-5 w-32 rounded bg-slate-200" />
        <div className="space-y-2">
          <div className="h-4 w-full rounded bg-slate-200" />
          <div className="h-4 w-full rounded bg-slate-200" />
          <div className="h-4 w-3/4 rounded bg-slate-200" />
        </div>
      </section>

      {/* Copy: "Opening lesson pack..." */}
      <div className="flex items-center justify-center py-6 text-center">
        <p className="text-sm font-medium text-slate-600">Opening lesson pack…</p>
      </div>
    </div>
  );
}

/**
 * Minimal skeleton for the lesson page loading state.
 * Shows just the essential title/header structure.
 */
export function LessonPageSkeleton() {
  return (
    <div className="mx-auto max-w-5xl space-y-6 p-6 text-slate-900 md:p-10 animate-pulse">
      <div>
        <div className="h-10 w-3/4 rounded bg-slate-200" />
        <div className="mt-2 h-4 w-1/2 rounded bg-slate-200" />
      </div>

      <section className="rounded-2xl border bg-white p-5 space-y-4">
        <div className="h-6 w-40 rounded bg-slate-200" />
        <div className="space-y-3">
          <div className="h-4 w-full rounded bg-slate-200" />
          <div className="h-4 w-full rounded bg-slate-200" />
          <div className="h-4 w-3/4 rounded bg-slate-200" />
        </div>
      </section>

      <div className="flex items-center justify-center py-8 text-center">
        <p className="text-sm font-medium text-slate-600">Opening lesson…</p>
      </div>
    </div>
  );
}
