"use client";

import type { ReactNode } from "react";
import Link from "next/link";

type BannerType = "info" | "success" | "warning" | "celebration";

type BannerAction = {
  label: string;
  href?: string;
  onClick?: () => void;
  variant?: "primary" | "ghost" | "warning";
};

type AuthNotificationBannerProps = {
  type: BannerType;
  icon?: ReactNode;
  message: string;
  subtext?: string;
  actions?: BannerAction[];
};

const BANNER_STYLES: Record<
  BannerType,
  { bg: string; border: string; text: string; gradient?: string }
> = {
  info: {
    bg: "rgba(83,74,183,0.10)",
    border: "rgba(83,74,183,0.25)",
    text: "#1E1B4B",
  },
  success: {
    bg: "rgba(5,150,105,0.10)",
    border: "rgba(5,150,105,0.25)",
    text: "#065F46",
  },
  warning: {
    bg: "rgba(245,158,11,0.10)",
    border: "rgba(245,158,11,0.25)",
    text: "#92400E",
  },
  celebration: {
    bg: "rgba(83,74,183,0.08)",
    border: "rgba(83,74,183,0.25)",
    text: "#1E1B4B",
    gradient: "linear-gradient(135deg, rgba(83,74,183,0.14), rgba(245,158,11,0.14))",
  },
};

function ActionButton({ action }: { action: BannerAction }) {
  const base =
    "inline-flex items-center justify-center rounded-[12px] px-4 py-2 text-sm font-bold transition-all duration-200";
  const style =
    action.variant === "ghost"
      ? "border-[1.5px] border-[#534AB7] bg-transparent text-[#534AB7] hover:bg-[#EEEDFE]"
      : action.variant === "warning"
      ? "border-[1.5px] border-[#F59E0B] bg-transparent text-[#92400E] hover:bg-[#FFFBEB]"
      : "bg-gradient-to-br from-[#534AB7] to-[#3D35A0] text-white shadow-[0_4px_16px_rgba(83,74,183,0.35)] hover:-translate-y-[1px] hover:shadow-[0_6px_18px_rgba(83,74,183,0.4)]";

  const className = `${base} ${style}`;

  if (action.href) {
    return (
      <Link href={action.href} className={className} style={{ fontFamily: '"Trebuchet MS", sans-serif' }}>
        {action.label}
      </Link>
    );
  }

  return (
    <button
      type="button"
      onClick={action.onClick}
      className={className}
      style={{ fontFamily: '"Trebuchet MS", sans-serif' }}
    >
      {action.label}
    </button>
  );
}

export default function AuthNotificationBanner({
  type,
  icon,
  message,
  subtext,
  actions = [],
}: AuthNotificationBannerProps) {
  const palette = BANNER_STYLES[type];

  return (
    <div
      className="animate-fade-slide-down rounded-[14px] border px-[18px] py-[14px]"
      style={{
        background: palette.gradient ?? palette.bg,
        borderColor: palette.border,
      }}
    >
      <div className="flex items-start gap-3">
        <div className="pt-0.5 text-base">{icon ?? "ℹ️"}</div>
        <div className="min-w-0 flex-1">
          <p
            className="text-sm"
            style={{
              color: palette.text,
              fontFamily: '"Trebuchet MS", sans-serif',
            }}
          >
            {message}
          </p>
          {subtext ? (
            <p
              className="mt-1 text-xs text-[#475569]"
              style={{ fontFamily: '"Trebuchet MS", sans-serif' }}
            >
              {subtext}
            </p>
          ) : null}
        </div>
      </div>

      {actions.length ? (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          {actions.map((action) => (
            <ActionButton key={action.label} action={action} />
          ))}
        </div>
      ) : null}
    </div>
  );
}
