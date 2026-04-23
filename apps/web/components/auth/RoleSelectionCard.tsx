import type { ReactNode } from "react";

type RoleSelectionCardProps = {
  title: string;
  description: string;
  icon: ReactNode;
  onClick: () => void;
  busy?: boolean;
};

export default function RoleSelectionCard({
  title,
  description,
  icon,
  onClick,
  busy = false,
}: RoleSelectionCardProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={busy}
      className="group flex h-full w-full flex-col rounded-[20px] border border-[#E2E8F0] bg-white p-6 text-left shadow-[0_4px_24px_rgba(83,74,183,0.08)] transition-all duration-200 hover:-translate-y-1 hover:border-[#534AB7] hover:bg-[#FAFAFE] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#534AB7]/70 disabled:cursor-not-allowed disabled:opacity-70"
    >
      <div className="inline-flex h-12 w-12 items-center justify-center rounded-[12px] bg-[#EEEDFE] text-[#534AB7] transition-colors group-hover:bg-[#534AB7] group-hover:text-white">
        {icon}
      </div>

      <h3
        className="mt-5 text-xl font-bold tracking-tight text-[#1E1B4B]"
        style={{ fontFamily: '"Playfair Display", Georgia, serif' }}
      >
        {title}
      </h3>
      <p
        className="mt-3 text-sm leading-relaxed text-[#475569]"
        style={{ fontFamily: '"Trebuchet MS", sans-serif' }}
      >
        {description}
      </p>

      <div
        className="mt-6 text-sm font-bold text-[#534AB7]"
        style={{ fontFamily: '"Trebuchet MS", sans-serif' }}
      >
        {busy ? "Preparing..." : "Continue →"}
      </div>
    </button>
  );
}