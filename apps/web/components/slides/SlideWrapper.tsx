"use client";

import React from "react";

type SlideWrapperProps = {
  children: React.ReactNode;
  deckTitle?: string;
  slideTypeLabel?: string;
  slideNumber?: number;
  totalSlides?: number;
  className?: string;
};

export default function SlideWrapper({
  children,
  deckTitle,
  slideTypeLabel,
  slideNumber,
  totalSlides,
  className = "",
}: SlideWrapperProps) {
  return (
    <div
      className={[
        "relative w-full overflow-hidden rounded-[1.75rem] border border-white/60 bg-white",
        "shadow-[0_44px_110px_-32px_rgba(13,10,30,0.28),0_14px_36px_-16px_rgba(13,10,30,0.14)]",
        "ring-1 ring-black/[0.02]",
        className,
      ].join(" ")}
      style={{ aspectRatio: "16 / 9" }}
    >
      {/* Top chrome — minimal floating pills */}
      <div className="pointer-events-none absolute inset-x-0 top-0 z-20 flex items-center justify-between px-5 py-3">
        <span className="max-w-[30ch] truncate rounded-full border border-white/50 bg-white/72 px-3 py-1 text-[9px] font-semibold text-gray-500 shadow-sm backdrop-blur-sm">
          {deckTitle ?? "Untitled lesson"}
        </span>
        {slideTypeLabel && (
          <span className="rounded-full border border-white/50 bg-white/72 px-2.5 py-1 text-[8px] font-bold uppercase tracking-[0.16em] text-gray-500 shadow-sm backdrop-blur-sm">
            {slideTypeLabel}
          </span>
        )}
      </div>

      {/* Main content */}
      <div className="relative z-0 h-full w-full">{children}</div>

      {/* Bottom chrome — slide counter + branding with separator */}
      <div
        className="pointer-events-none absolute inset-x-0 bottom-0 z-20 flex items-center justify-between px-5 py-2"
        style={{ borderTop: "1px solid rgba(108,99,255,0.08)" }}
      >
        <span className="rounded-full border border-white/40 bg-white/65 px-2.5 py-0.5 text-[9px] font-medium tabular-nums text-[#9CA3AF] shadow-sm backdrop-blur-sm">
          {typeof slideNumber === "number" && typeof totalSlides === "number"
            ? `${slideNumber} / ${totalSlides}`
            : ""}
        </span>
        <span className="flex items-center gap-1.5 rounded-full border border-white/40 bg-white/65 px-2.5 py-0.5 text-[8px] font-bold uppercase tracking-[0.18em] text-[#9CA3AF] shadow-sm backdrop-blur-sm">
          <span className="h-1 w-1 rounded-full bg-[#6C63FF]" />
          LessonForge
        </span>
      </div>
    </div>
  );
}
