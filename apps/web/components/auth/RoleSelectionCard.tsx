import type { ReactNode } from "react";

type RoleSelectionCardProps = {
  title: string;
  description: string;
  badge: string;
  badgeTone: "teacher" | "purple";
  icon: ReactNode;
  onClick: () => void;
  busy?: boolean;
  tone?: "teacher" | "principal";
};

export default function RoleSelectionCard({
  title,
  description,
  badge,
  badgeTone,
  icon,
  onClick,
  busy = false,
  tone = "teacher",
}: RoleSelectionCardProps) {
  const isPrincipal = tone === "principal";

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={busy}
      className={[
        "group flex h-full min-h-[330px] w-full flex-col rounded-[20px] border p-6 text-left shadow-[0_4px_24px_rgba(83,74,183,0.08)] transition-all duration-200 hover:-translate-y-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#534AB7]/70 disabled:cursor-not-allowed disabled:opacity-70",
        isPrincipal
          ? "border-[#C4B5FD] bg-gradient-to-b from-white to-[#F5F3FF] hover:border-[#6C63FF] hover:shadow-[0_10px_32px_rgba(108,99,255,0.18)]"
          : "border-[#C4B5FD] bg-gradient-to-b from-white to-[#F3F0FF] hover:border-[#6C63FF] hover:shadow-[0_10px_32px_rgba(108,99,255,0.16)]",
      ].join(" ")}
    >
      <div className="flex items-start justify-between gap-3">
        <div
          className={[
            "inline-flex h-12 w-12 items-center justify-center rounded-[12px] transition-colors",
            isPrincipal
              ? "bg-[#EEEDFE] text-[#534AB7] group-hover:bg-[#534AB7] group-hover:text-white"
              : "bg-[#F3F0FF] text-[#6C63FF] group-hover:bg-[#6C63FF] group-hover:text-white",
          ].join(" ")}
        >
          {icon}
        </div>
        <span
          className={[
            "rounded-full px-3 py-1 text-xs font-bold",
            badgeTone === "teacher"
              ? "bg-[#F3F0FF] text-[#7C3AED]"
              : "bg-[#EEEDFE] text-[#534AB7]",
          ].join(" ")}
          style={{ fontFamily: '"Trebuchet MS", sans-serif' }}
        >
          {badge}
        </span>
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
        className={[
          "mt-auto pt-6 text-sm font-bold",
          isPrincipal ? "text-[#534AB7]" : "text-[#6C63FF]",
        ].join(" ")}
        style={{ fontFamily: '"Trebuchet MS", sans-serif' }}
      >
        {busy ? "Preparing..." : "Continue ->"}
      </div>
    </button>
  );
}
