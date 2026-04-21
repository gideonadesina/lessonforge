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
 * - top chrome (deck title + slide type label)
 * - bottom chrome (slide number + LessonForge branding)
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
        "relative w-full overflow-hidden rounded-3xl border border-gray-200 bg-white",
        "shadow-[0_30px_80px_-30px_rgba(17,17,39,0.25),0_8px_24px_-12px_rgba(17,17,39,0.12)]",
        "ring-1 ring-black/[0.02]",
        className,
      ].join(" ")}
      style={{ aspectRatio: "16 / 9" }}
    >
      {/* Subtle ambient background tint */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-gradient-to-br from-white via-white to-purple-50/40"
      />

      {/* Top chrome */}
      <div className="absolute inset-x-0 top-0 z-10 flex items-center justify-between px-8 py-4">
        <div className="flex items-center gap-3">
          <div className="flex h-6 w-6 items-center justify-center rounded-md bg-gradient-to-br from-purple-600 to-purple-500 text-[11px] font-bold text-white shadow-sm">
            L
          </div>
          <span className="max-w-[40ch] truncate text-xs font-medium text-gray-500">
            {deckTitle ?? "Untitled lesson"}
          </span>
        </div>
        {slideTypeLabel && (
          <span className="rounded-full border border-gray-200 bg-white/70 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.2em] text-gray-500 backdrop-blur">
            {slideTypeLabel}
          </span>
        )}
      </div>

      {/* Main content area — slide body renders here */}
      <div className="relative z-0 h-full w-full pb-12 pt-14">{children}</div>

      {/* Bottom chrome */}
      <div className="absolute inset-x-0 bottom-0 z-10 flex items-center justify-between px-8 py-3">
        <span className="text-[11px] font-medium tabular-nums text-gray-400">
          {typeof slideNumber === "number" && typeof totalSlides === "number"
            ? `${slideNumber} / ${totalSlides}`
            : ""}
        </span>
        <span className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.22em] text-gray-400">
          <span className="h-1 w-1 rounded-full bg-purple-500" />
          LessonForge
        </span>
      </div>
    </div>
  );
}
