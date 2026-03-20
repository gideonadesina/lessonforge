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
    <section className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div>
          <h2 className="text-lg font-bold tracking-tight text-slate-900">
            Weekly Teaching Insight
          </h2>
          <p className="mt-1 text-sm text-slate-600">
            A simple view of your teaching rhythm and what to improve next.
          </p>
        </div>

        <div className="rounded-full border border-violet-200 bg-violet-50 px-3 py-1.5 text-xs font-semibold text-violet-700">
          This week
        </div>
      </div>

      <div className="mt-5 grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
          <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Lessons Created
          </div>
          <div className="mt-2 text-3xl font-extrabold tracking-tight text-slate-900">
            {totalLessons}
          </div>
          <div className="mt-1 text-sm text-slate-600">
            Total saved lesson packs
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
          <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Recent Activity
          </div>
          <div className="mt-2 text-3xl font-extrabold tracking-tight text-slate-900">
            {recent7d}
          </div>
          <div className="mt-1 text-sm text-slate-600">
            Lessons generated in the last 7 days
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
          <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Worksheets
          </div>
          <div className="mt-2 text-3xl font-extrabold tracking-tight text-slate-900">
            {worksheetsCreated}
          </div>
          <div className="mt-1 text-sm text-slate-600">
            Practice resources created
          </div>
        </div>
      </div>

      <div className="mt-5 rounded-2xl border border-slate-200 bg-gradient-to-r from-slate-50 to-violet-50 p-5">
        <div className="text-sm font-bold text-slate-900">{insight.title}</div>
        <p className="mt-2 text-sm leading-relaxed text-slate-700">
          {insight.body}
        </p>

        <div className="mt-4 rounded-xl border border-violet-100 bg-white/80 p-4">
          <div className="text-xs font-semibold uppercase tracking-wide text-violet-700">
            ForgeGuide Suggestion
          </div>
          <p className="mt-2 text-sm leading-relaxed text-slate-700">
            {insight.suggestion}
          </p>
        </div>
      </div>
    </section>
  );
}