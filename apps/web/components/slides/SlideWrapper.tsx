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

/**
 * Premium, reusable slide shell.
 *
 * Provides:
 * - 16:9 stage surface
 * - soft premium shadow + subtle border
 * - minimal chrome that does not squeeze the slide body
 *
 * The inner content area is where slide bodies render.
 */
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
        "relative w-full overflow-hidden rounded-[2rem] border border-white/70 bg-white",
        "shadow-[0_36px_100px_-36px_rgba(17,17,39,0.32),0_10px_28px_-14px_rgba(17,17,39,0.16)]",
        "ring-1 ring-black/[0.02]",
        className,
      ].join(" ")}
      style={{ aspectRatio: "16 / 9" }}
    >
      {/* Top chrome: intentionally small so the slide owns the canvas. */}
      <div className="pointer-events-none absolute inset-x-0 top-0 z-20 flex items-center justify-between px-5 py-4">
        <span className="max-w-[34ch] truncate rounded-full border border-white/70 bg-white/75 px-3 py-1 text-[10px] font-semibold text-gray-500 shadow-sm backdrop-blur">
          {deckTitle ?? "Untitled lesson"}
        </span>
        {slideTypeLabel && (
          <span className="rounded-full border border-white/70 bg-white/75 px-3 py-1 text-[9px] font-bold uppercase tracking-[0.18em] text-gray-500 shadow-sm backdrop-blur">
            {slideTypeLabel}
          </span>
        )}
      </div>

      {/* Main content area — slide body renders here */}
      <div className="relative z-0 h-full w-full">{children}</div>

      {/* Bottom chrome */}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 z-20 flex items-center justify-between px-5 py-4">
        <span className="rounded-full border border-white/60 bg-white/70 px-2 py-1 text-[10px] font-semibold tabular-nums text-gray-400 shadow-sm backdrop-blur">
          {typeof slideNumber === "number" && typeof totalSlides === "number"
            ? `${slideNumber} / ${totalSlides}`
            : ""}
        </span>
        <span className="flex items-center gap-1.5 rounded-full border border-white/60 bg-white/70 px-2 py-1 text-[9px] font-bold uppercase tracking-[0.18em] text-gray-400 shadow-sm backdrop-blur">
          <span className="h-1 w-1 rounded-full bg-purple-500" />
          LessonForge
        </span>
      </div>
    </div>
  );
}
