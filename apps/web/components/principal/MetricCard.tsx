"use client";

export default function MetricCard({
  title,
  value,
  subtitle,
}: {
  title: string;
  value: string | number;
  subtitle?: string;
}) {
  return (
    <div className="rounded-2xl border border-violet-100/80 bg-white p-5 shadow-[0_6px_24px_rgba(88,28,135,0.08)]">
      <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">{title}</div>
      <div className="mt-2 text-3xl font-black tracking-tight text-slate-900">{value}</div>
      {subtitle ? <div className="mt-2 text-xs text-slate-600">{subtitle}</div> : null}
    </div>
  );
}