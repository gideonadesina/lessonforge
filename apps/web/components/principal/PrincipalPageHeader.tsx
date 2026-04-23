"use client";

export default function PrincipalPageHeader({
  eyebrow,
  title,
  description,
}: {
  eyebrow: string;
  title: string;
  description: string;
}) {
  return (
    <header className="rounded-2xl border border-[var(--border)] bg-[var(--card)] px-5 py-4 shadow-[0_6px_24px_rgba(88,28,135,0.08)]">
      <p className="text-xs font-semibold uppercase tracking-wide text-violet-700">{eyebrow}</p>
      <h1 className="mt-1 text-2xl font-black tracking-tight text-[var(--text-primary)]">{title}</h1>
      <p className="mt-1 text-sm text-[var(--text-secondary)]">{description}</p>
    </header>
  );
}