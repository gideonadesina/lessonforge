const updates = [
  {
    title: "Help and support menu",
    date: "2026-04-30",
    summary:
      "A new Help menu gives teachers and principals fast access to support, bug reports, policies, and release notes.",
  },
  {
    title: "More reliable export and image handling",
    date: "2026-04-30",
    summary:
      "PPTX downloads now use the correct presentation file type, and lesson visuals use shorter, more concrete image searches.",
  },
  {
    title: "Planning notifications",
    date: "2026-04-29",
    summary:
      "Timetable reminders and planning alerts help teachers keep upcoming lessons prepared.",
  },
];

export default function UpdatesPage() {
  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm font-semibold uppercase tracking-wide text-violet-700">Release Notes</p>
        <h1 className="mt-2 text-3xl font-black text-[var(--text-primary)]">LessonForge updates</h1>
        <p className="mt-2 max-w-2xl text-sm text-[var(--text-secondary)]">
          Recent product changes and improvements.
        </p>
      </div>

      <div className="space-y-3">
        {updates.map((update) => (
          <article
            key={`${update.date}-${update.title}`}
            className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-5 shadow-sm"
          >
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-base font-bold text-[var(--text-primary)]">{update.title}</h2>
              <time className="rounded-full border border-[var(--border)] bg-[var(--card-alt)] px-3 py-1 text-xs font-semibold text-[var(--text-secondary)]">
                {update.date}
              </time>
            </div>
            <p className="mt-2 text-sm leading-6 text-[var(--text-secondary)]">{update.summary}</p>
          </article>
        ))}
      </div>
    </div>
  );
}
