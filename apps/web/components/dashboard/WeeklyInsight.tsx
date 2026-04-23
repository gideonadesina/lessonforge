"use client";

type WeeklyInsightProps = {
  totalLessons?: number;
  recent7d?: number;
  creditsRemaining?: number;
  worksheetsCreated?: number;
};

function buildInsightMessage(args: {
  totalLessons: number;
  recent7d: number;
  creditsRemaining: number;
  worksheetsCreated: number;
}) {
  const { totalLessons, recent7d, creditsRemaining, worksheetsCreated } = args;

  if (recent7d >= 5) {
    return {
      title: "Strong momentum this week",
      body: "You’ve been actively generating lessons this week. Keep building ahead so you stay prepared before classes begin.",
      suggestion: "Use your best recent lesson as a model for consistency across subjects.",
    };
  }

  if (creditsRemaining <= 10) {
    return {
      title: "Watch your remaining credits",
      body: "Your available credits are getting low. Be intentional with generation and prioritize the lessons you need most first.",
      suggestion: "Focus on high-priority classes and core subjects until you top up again.",
    };
  }

  if (worksheetsCreated === 0) {
    return {
      title: "Add more practice resources",
      body: "You’ve built lessons, but practice materials help learners retain more. Consider turning one recent lesson into a worksheet.",
      suggestion: "A worksheet linked to your latest topic can strengthen revision and homework quality.",
    };
  }

  return {
    title: "Healthy teaching workflow",
    body: "Your workspace is progressing well. Continue balancing lesson preparation, resources, and classroom activities for stronger teaching impact.",
    suggestion: "Choose one recent lesson and improve its activities or assessment before class.",
  };
}

export default function WeeklyInsight({
  totalLessons = 0,
  recent7d = 0,
  creditsRemaining = 0,
  worksheetsCreated = 0,
}: WeeklyInsightProps) {
  const insight = buildInsightMessage({
    totalLessons,
    recent7d,
    creditsRemaining,
    worksheetsCreated,
  });

  return (
    <section className="rounded-[28px] border border-[var(--border)] bg-[var(--card)] p-5 shadow-sm">
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div>
          <h2 className="text-lg font-bold tracking-tight text-[var(--text-primary)]">
            Weekly Teaching Insight
          </h2>
          <p className="mt-1 text-sm text-[var(--text-secondary)]">
            A simple view of your teaching rhythm and what to improve next.
          </p>
        </div>

        <div className="rounded-full border border-violet-200 bg-violet-50 px-3 py-1.5 text-xs font-semibold text-violet-700 dark:border-violet-800 dark:bg-violet-900/30 dark:text-violet-400">
          This week
        </div>
      </div>

      <div className="mt-5 grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--card-alt)] p-4">
          <div className="text-xs font-semibold uppercase tracking-wide text-[var(--text-tertiary)]">
            Lessons Created
          </div>
          <div className="mt-2 text-3xl font-extrabold tracking-tight text-[var(--text-primary)]">
            {totalLessons}
          </div>
          <div className="mt-1 text-sm text-[var(--text-secondary)]">
            Total saved lesson packs
          </div>
        </div>

        <div className="rounded-2xl border border-[var(--border)] bg-[var(--card-alt)] p-4">
          <div className="text-xs font-semibold uppercase tracking-wide text-[var(--text-tertiary)]">
            Recent Activity
          </div>
          <div className="mt-2 text-3xl font-extrabold tracking-tight text-[var(--text-primary)]">
            {recent7d}
          </div>
          <div className="mt-1 text-sm text-[var(--text-secondary)]">
            Lessons generated in the last 7 days
          </div>
        </div>

        <div className="rounded-2xl border border-[var(--border)] bg-[var(--card-alt)] p-4">
          <div className="text-xs font-semibold uppercase tracking-wide text-[var(--text-tertiary)]">
            Worksheets
          </div>
          <div className="mt-2 text-3xl font-extrabold tracking-tight text-[var(--text-primary)]">
            {worksheetsCreated}
          </div>
          <div className="mt-1 text-sm text-[var(--text-secondary)]">
            Practice resources created
          </div>
        </div>
      </div>

      <div className="mt-5 rounded-2xl border border-[var(--border)] bg-gradient-to-r from-[var(--card-alt)] to-violet-50 p-5 dark:to-violet-900/20">
        <div className="text-sm font-bold text-[var(--text-primary)]">{insight.title}</div>
        <p className="mt-2 text-sm leading-relaxed text-[var(--text-secondary)]">
          {insight.body}
        </p>

        <div className="mt-4 rounded-xl border border-violet-100 bg-[var(--card)]/80 p-4 dark:border-violet-800">
          <div className="text-xs font-semibold uppercase tracking-wide text-violet-700 dark:text-violet-400">
            ForgeGuide Suggestion
          </div>
          <p className="mt-2 text-sm leading-relaxed text-[var(--text-secondary)]">
            {insight.suggestion}
          </p>
        </div>
      </div>
    </section>
  );
}