import type { ReactNode } from "react";

type RoleSelectionCardProps = {
  title: string;
  description: string;
  icon: ReactNode;
  onClick: () => void;
};

export default function RoleSelectionCard({
  title,
  description,
  icon,
  onClick,
}: RoleSelectionCardProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="group flex h-full w-full flex-col rounded-[1.5rem] border border-violet-100 bg-white p-6 text-left shadow-[0_22px_50px_-38px_rgba(15,23,42,0.75)] transition-all duration-300 hover:-translate-y-1 hover:border-violet-300 hover:shadow-[0_34px_70px_-42px_rgba(76,29,149,0.48)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500/70"
    >
      <div className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-violet-100 text-violet-700 transition-colors group-hover:bg-violet-700 group-hover:text-white">
        {icon}
      </div>

      <h3 className="mt-5 text-xl font-semibold tracking-tight text-slate-900">{title}</h3>
      <p className="mt-3 text-sm leading-relaxed text-slate-600">{description}</p>

      <div className="mt-6 text-sm font-semibold text-violet-700">Continue -&gt;</div>
    </button>
  );
}