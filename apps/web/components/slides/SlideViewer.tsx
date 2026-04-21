"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import SlideWrapper from "./SlideWrapper";
import {
  renderSlide,
  getSlideTypeLabel,
  getSlideHeadline,
  type SlideDeck,
  type Slide,
} from "../../lib/slideRenderer";
import { exportToPdf } from "../../lib/exportToPdf";
import { exportToPptx } from "../../lib/exportToPptx";

type SlideViewerProps = {
  deck: SlideDeck;
};

export default function SlideViewer({ deck }: SlideViewerProps) {
  const slides = deck?.slides ?? [];
  const totalSlides = slides.length;

  const [activeIndex, setActiveIndex] = useState(0);
  const [exportingPdf, setExportingPdf] = useState(false);
  const [exportingPptx, setExportingPptx] = useState(false);

  useEffect(() => {
    if (activeIndex > totalSlides - 1) {
      setActiveIndex(Math.max(0, totalSlides - 1));
    }
  }, [activeIndex, totalSlides]);

  const activeSlide: Slide | undefined = slides[activeIndex];

  const canGoPrev = activeIndex > 0;
  const canGoNext = activeIndex < totalSlides - 1;

  const goPrev = useCallback(() => {
    setActiveIndex((i) => Math.max(0, i - 1));
  }, []);

  const goNext = useCallback(() => {
    setActiveIndex((i) => Math.min(totalSlides - 1, i + 1));
  }, [totalSlides]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight") goNext();
      else if (e.key === "ArrowLeft") goPrev();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [goNext, goPrev]);

  const handleExportPDF = async () => {
    if (exportingPdf || !deck) return;
    setExportingPdf(true);
    try {
      await exportToPdf(deck);
    } catch (err) {
      console.error("PDF export failed:", err);
      alert("Failed to export PDF. Please try again.");
    } finally {
      setExportingPdf(false);
    }
  };

  const handleExportPPTX = async () => {
    if (exportingPptx || !deck) return;
    setExportingPptx(true);
    try {
      await exportToPptx(deck);
    } catch (err) {
      console.error("PPTX export failed:", err);
      alert("Failed to export PPTX. Please try again.");
    } finally {
      setExportingPptx(false);
    }
  };

  const handlePresent = () => {
    console.log("[SlideViewer] Present mode requested", { deck });
  };

  const metadata = useMemo(
    () => ({
      deckTitle: deck?.deck_title ?? "Untitled lesson",
      subject: deck?.subject ?? "—",
      grade: deck?.grade ?? "—",
      bloomLevel: deck?.bloom_level ?? "—",
    }),
    [deck]
  );

  if (!activeSlide) {
    return (
      <div className="min-h-screen w-full bg-gradient-to-b from-[#FAFAF8] to-[#F5F4F1] px-6 py-16">
        <div className="mx-auto max-w-3xl rounded-2xl border border-gray-200 bg-white p-10 text-center shadow-sm">
          <h2 className="text-xl font-semibold text-gray-900">
            No slides to display
          </h2>
          <p className="mt-2 text-sm text-gray-500">
            This deck is empty. Generate a lesson to see your slides here.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen w-full bg-gradient-to-b from-[#FAFAF8] via-[#F7F6F2] to-[#F2F0EC]">
      <div className="mx-auto flex w-full max-w-[1280px] flex-col gap-8 px-6 py-10 md:px-10 md:py-14">
        <header className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div className="min-w-0">
            <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.22em] text-purple-600">
              <span className="h-1.5 w-1.5 rounded-full bg-purple-500" />
              Lesson Deck
            </div>
            <h1 className="mt-2 truncate text-2xl font-semibold tracking-tight text-gray-900 md:text-3xl">
              {metadata.deckTitle}
            </h1>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <MetaPill label="Subject" value={metadata.subject} />
              <MetaPill label="Grade" value={metadata.grade} />
              <MetaPill label="Bloom" value={metadata.bloomLevel} accent />
              <MetaPill label="Slides" value={String(totalSlides)} muted />
            </div>
          </div>

          <div className="flex items-center gap-2">
            <ToolbarButton
              onClick={handleExportPDF}
              label={exportingPdf ? "Exporting..." : "Export PDF"}
              disabled={exportingPdf}
            />
            <ToolbarButton
              onClick={handleExportPPTX}
              label={exportingPptx ? "Exporting..." : "Export PPTX"}
              disabled={exportingPptx}
            />
            <ToolbarButton onClick={handlePresent} label="Present" primary />
          </div>
        </header>

        <section className="relative flex w-full items-center justify-center">
          <StageNavButton direction="prev" disabled={!canGoPrev} onClick={goPrev} />

          <div className="w-full max-w-[1120px]" data-slide={activeIndex}>
            <SlideWrapper
              deckTitle={metadata.deckTitle}
              slideTypeLabel={getSlideTypeLabel(activeSlide)}
              slideNumber={activeIndex + 1}
              totalSlides={totalSlides}
            >
              {renderSlide(activeSlide)}
            </SlideWrapper>
          </div>

          <StageNavButton direction="next" disabled={!canGoNext} onClick={goNext} />
        </section>

        <div className="flex items-center justify-between">
          <p className="text-xs text-gray-500">
            <span className="font-semibold text-gray-700">
              Slide {activeIndex + 1}
            </span>{" "}
            of {totalSlides} · {getSlideTypeLabel(activeSlide)}
          </p>
          <div className="flex items-center gap-2">
            <SecondaryButton onClick={goPrev} disabled={!canGoPrev} label="Previous" />
            <SecondaryButton onClick={goNext} disabled={!canGoNext} label="Next" primary />
          </div>
        </div>

        <div className="-mx-2 overflow-x-auto pb-2">
          <ol className="flex min-w-max gap-3 px-2">
            {slides.map((slide, i) => {
              const isActive = i === activeIndex;
              return (
                <li key={i}>
                  <button
                    type="button"
                    onClick={() => setActiveIndex(i)}
                    className={[
                      "group relative flex w-[176px] flex-col overflow-hidden rounded-xl border bg-white text-left transition",
                      "shadow-[0_4px_14px_-6px_rgba(17,17,39,0.12)]",
                      isActive
                        ? "border-purple-500 ring-2 ring-purple-500/40"
                        : "border-gray-200 hover:border-gray-300 hover:-translate-y-0.5",
                    ].join(" ")}
                    aria-label={`Go to slide ${i + 1}`}
                  >
                    <div
                      className="relative w-full bg-gradient-to-br from-white to-gray-50"
                      style={{ aspectRatio: "16 / 9" }}
                    >
                      <div className="absolute left-2 top-2 rounded-md bg-black/70 px-1.5 py-0.5 text-[10px] font-semibold text-white">
                        {i + 1}
                      </div>
                      <div className="flex h-full w-full flex-col justify-center px-3">
                        <p className="line-clamp-3 text-[11px] font-semibold leading-tight text-gray-800">
                          {getSlideHeadline(slide)}
                        </p>
                      </div>
                      {isActive && (
                        <div className="absolute inset-0 rounded-[10px] ring-2 ring-inset ring-purple-500/20" />
                      )}
                    </div>
                    <div className="border-t border-gray-100 bg-white px-3 py-2">
                      <p
                        className={[
                          "truncate text-[10px] font-semibold uppercase tracking-[0.14em]",
                          isActive ? "text-purple-700" : "text-gray-500",
                        ].join(" ")}
                      >
                        {getSlideTypeLabel(slide)}
                      </p>
                    </div>
                  </button>
                </li>
              );
            })}
          </ol>
        </div>
      </div>
    </div>
  );
}

function MetaPill({
  label,
  value,
  accent,
  muted,
}: {
  label: string;
  value: string;
  accent?: boolean;
  muted?: boolean;
}) {
  const base =
    "inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-[11px] font-medium";
  const tone = accent
    ? "border-amber-200 bg-amber-50 text-amber-800"
    : muted
    ? "border-gray-200 bg-gray-50 text-gray-600"
    : "border-gray-200 bg-white text-gray-700";
  return (
    <span className={`${base} ${tone}`}>
      <span className="text-[10px] font-semibold uppercase tracking-[0.18em] opacity-70">
        {label}
      </span>
      <span>{value}</span>
    </span>
  );
}

function ToolbarButton({
  label,
  onClick,
  primary,
  disabled,
}: {
  label: string;
  onClick: () => void;
  primary?: boolean;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={[
        "rounded-xl px-4 py-2 text-sm font-semibold transition",
        "disabled:opacity-50 disabled:cursor-not-allowed",
        primary
          ? "bg-gray-900 text-white shadow-sm hover:bg-black"
          : "border border-gray-200 bg-white text-gray-700 hover:border-gray-300 hover:bg-gray-50",
      ].join(" ")}
    >
      {label}
    </button>
  );
}

function SecondaryButton({
  label,
  onClick,
  disabled,
  primary,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  primary?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={[
        "rounded-xl px-4 py-2 text-sm font-semibold transition",
        "disabled:cursor-not-allowed disabled:opacity-40",
        primary
          ? "bg-purple-600 text-white shadow-sm hover:bg-purple-700"
          : "border border-gray-200 bg-white text-gray-700 hover:border-gray-300 hover:bg-gray-50",
      ].join(" ")}
    >
      {label}
    </button>
  );
}

function StageNavButton({
  direction,
  disabled,
  onClick,
}: {
  direction: "prev" | "next";
  disabled?: boolean;
  onClick: () => void;
}) {
  const isPrev = direction === "prev";
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={isPrev ? "Previous slide" : "Next slide"}
      className={[
        "group absolute top-1/2 z-10 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full border border-gray-200 bg-white/90 backdrop-blur transition",
        "shadow-[0_6px_20px_-8px_rgba(17,17,39,0.25)]",
        "hover:bg-white disabled:cursor-not-allowed disabled:opacity-30",
        isPrev ? "-left-2 md:-left-6" : "-right-2 md:-right-6",
      ].join(" ")}
    >
      <svg
        viewBox="0 0 24 24"
        width="18"
        height="18"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="text-gray-700 transition group-hover:text-gray-900"
        style={{ transform: isPrev ? "rotate(180deg)" : undefined }}
      >
        <path d="M9 6l6 6-6 6" />
      </svg>
    </button>
  );
}