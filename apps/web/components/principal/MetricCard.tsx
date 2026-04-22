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
    <div className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-5 shadow-[0_6px_24px_rgba(88,28,135,0.08)]">
      <div className="text-xs font-semibold uppercase tracking-wide text-[var(--text-tertiary)]">{title}</div>
      <div className="mt-2 text-3xl font-black tracking-tight text-[var(--text-primary)]">{value}</div>
      {subtitle ? <div className="mt-2 text-xs text-[var(--text-secondary)]">{subtitle}</div> : null}
    </div>
  );
}