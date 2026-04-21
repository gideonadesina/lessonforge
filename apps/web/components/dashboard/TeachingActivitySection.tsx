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
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-[#1A2847] bg-white dark:bg-[#0B1530]">
      <div className="mb-6">
        <h2 className="text-lg font-bold tracking-tight text-slate-900 dark:text-white">
          Teaching Activity
        </h2>
        <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
          Your lesson generation rhythm over the last 7 days.
        </p>
      </div>

      <div className="space-y-6">
        {/* Activity Chart */}
        <div>
          <div className="flex items-end justify-between gap-1">
            {activityBars.map((bar, i) => (
              <div key={i} className="flex flex-1 flex-col items-center gap-2">
                <div className="w-full rounded-full bg-slate-200 transition-all duration-300 dark:bg-[#1A2847]" style={{ height: "120px", minWidth: "8px" }}>
                  <div
                    className="w-full rounded-full bg-violet-600 transition-all duration-300"
                    style={{
                      height: `${bar.heightPct}%`,
                      minHeight: bar.value > 0 ? "4px" : "0px",
                    }}
                  />
                </div>
                <span className="text-[10px] text-slate-500 font-medium dark:text-slate-400">
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
    <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 dark:border-[#1A2847] dark:bg-[#101827]">
      <div className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
        {label}
      </div>
      <div className="mt-1 text-2xl font-extrabold text-slate-900 dark:text-white">{value}</div>
      {sublabel && <div className="text-xs text-slate-500 dark:text-slate-400">{sublabel}</div>}
    </div>
  );
}
