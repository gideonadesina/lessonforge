import Link from "next/link";
import type { LucideIcon } from "lucide-react";

export default function PlanningToolCard({
  href,
  title,
  description,
  icon: Icon,
}: {
  href: string;
  title: string;
  description: string;
  icon: LucideIcon;
}) {
  return (
    <Link
      href={href}
      className="group rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition hover:-translate-y-0.5 hover:border-violet-200 hover:shadow-md"
    >
      <div className="inline-flex h-11 w-11 items-center justify-center rounded-xl bg-violet-50 text-violet-700 border border-violet-100">
        <Icon className="h-5 w-5" />
      </div>
      <h2 className="mt-4 text-lg font-bold text-slate-900">{title}</h2>
      <p className="mt-2 text-sm text-slate-600 leading-relaxed">{description}</p>
      <span className="mt-4 inline-flex text-sm font-semibold text-violet-700 group-hover:text-violet-800">
        Open tool →
      </span>
    </Link>
  );
}