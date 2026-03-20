"use client";

export default function SectionCard({
  title,
  subtitle,
  action,
  children,
}: {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-violet-100/80 bg-white p-5 shadow-[0_6px_24px_rgba(88,28,135,0.08)]">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-bold uppercase tracking-wide text-slate-900">{title}</h2>
          {subtitle ? <p className="mt-1 text-sm text-slate-600">{subtitle}</p> : null}
        </div>
        {action ? <div>{action}</div> : null}
      </div>
      <div className="mt-4">{children}</div>
    </section>
  );
}