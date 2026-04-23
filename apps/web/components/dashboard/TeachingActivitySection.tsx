"use client";

type TeachingActivityProps = {
  activityBars: Array<{ value: number; heightPct: number }>;
  totalLessons: number;
  recent7d: number;
  creditsRemaining: number;
  worksheetsCreated: number;
};

export default function TeachingActivitySection({
  activityBars,
  totalLessons,
  recent7d,
  creditsRemaining,
  worksheetsCreated,
}: TeachingActivityProps) {
  const last7Days = [
    "Mon",
    "Tue",
    "Wed",
    "Thu",
    "Fri",
    "Sat",
    "Sun",
  ];

  return (
    <section className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-5 shadow-sm">
      <div className="mb-6">
        <h2 className="text-lg font-bold tracking-tight text-[var(--text-primary)]">
          Teaching Activity
        </h2>
        <p className="mt-1 text-sm text-[var(--text-secondary)]">
          Your lesson generation rhythm over the last 7 days.
        </p>
      </div>

      <div className="space-y-6">
        {/* Activity Chart */}
        <div>
          <div className="flex items-end justify-between gap-1">
            {activityBars.map((bar, i) => (
              <div key={i} className="flex flex-1 flex-col items-center gap-2">
                <div className="w-full rounded-full bg-[var(--border)] transition-all duration-300" style={{ height: "120px", minWidth: "8px" }}>
                  <div
                    className="w-full rounded-full bg-violet-600 transition-all duration-300"
                    style={{
                      height: `${bar.heightPct}%`,
                      minHeight: bar.value > 0 ? "4px" : "0px",
                    }}
                  />
                </div>
                <span className="text-[10px] font-medium text-[var(--text-tertiary)]">
                  {last7Days[i]}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          <StatBox
            label="Total Lessons"
            value={totalLessons}
            sublabel="created"
          />
          <StatBox label="This Week" value={recent7d} sublabel="lessons" />
          <StatBox
            label="Worksheets"
            value={worksheetsCreated}
            sublabel="created"
          />
          <StatBox label="Credits Left" value={creditsRemaining} sublabel="" />
        </div>
      </div>
    </section>
  );
}

function StatBox({
  label,
  value,
  sublabel,
}: {
  label: string;
  value: number;
  sublabel: string;
}) {
  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--card-alt)] p-3">
      <div className="text-xs font-semibold uppercase tracking-wide text-[var(--text-tertiary)]">
        {label}
      </div>
      <div className="mt-1 text-2xl font-extrabold text-[var(--text-primary)]">{value}</div>
      {sublabel ? <div className="text-xs text-[var(--text-tertiary)]">{sublabel}</div> : null}
    </div>
  );
}
