"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
import { exportSlideToPng } from "../../lib/exportToPng";

type SlideViewerProps = {
  deck: SlideDeck;
};

export default function SlideViewer({ deck }: SlideViewerProps) {
  const [liveDeck, setLiveDeck] = useState<SlideDeck>(deck);
  const slides = liveDeck?.slides ?? [];
  const totalSlides = slides.length;

  const [activeIndex, setActiveIndex] = useState(0);
  const [exportingPdf, setExportingPdf] = useState(false);
  const [exportingPptx, setExportingPptx] = useState(false);
  const [exportingPng, setExportingPng] = useState(false);
  const [exportDropdownOpen, setExportDropdownOpen] = useState(false);
  const [googleSlidesNotice, setGoogleSlidesNotice] = useState(false);
  const slideContainerRef = useRef<HTMLDivElement>(null);
  const thumbnailRefs = useRef<(HTMLDivElement | null)[]>([]);
  const [thumbnailImages, setThumbnailImages] = useState<(string | null)[]>([]);

  useEffect(() => {
    setLiveDeck(deck);
  }, [deck]);

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

  const patchActiveSlide = useCallback(
    (patch: Record<string, unknown>) => {
      setLiveDeck((prev) => ({
        ...prev,
        slides: prev.slides.map((slide, index) =>
          index === activeIndex ? ({ ...slide, ...patch } as Slide) : slide
        ),
      }));
    },
    [activeIndex]
  );

  const replaceActiveSlide = useCallback(
    (nextSlide: Slide) => {
      setLiveDeck((prev) => ({
        ...prev,
        slides: prev.slides.map((slide, index) => (index === activeIndex ? nextSlide : slide)),
      }));
    },
    [activeIndex]
  );

  const moveActiveSlide = useCallback(
    (direction: -1 | 1) => {
      setLiveDeck((prev) => {
        const nextIndex = activeIndex + direction;
        if (nextIndex < 0 || nextIndex >= prev.slides.length) return prev;
        const nextSlides = [...prev.slides];
        const [moved] = nextSlides.splice(activeIndex, 1);
        nextSlides.splice(nextIndex, 0, moved);
        return { ...prev, slides: nextSlides };
      });
      setActiveIndex((index) => Math.min(totalSlides - 1, Math.max(0, index + direction)));
    },
    [activeIndex, totalSlides]
  );

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight") goNext();
      else if (e.key === "ArrowLeft") goPrev();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [goNext, goPrev]);

  // Capture real slide screenshots for the thumbnail strip
  useEffect(() => {
    setThumbnailImages(new Array(slides.length).fill(null));
    if (!slides.length) return;

    let cancelled = false;

    const captureAll = async () => {
      // Wait for slide images to load before capturing
      await new Promise<void>((resolve) => setTimeout(resolve, 900));
      if (cancelled) return;

      const html2canvas = (await import("html2canvas")).default;

      for (let i = 0; i < slides.length; i++) {
        if (cancelled) break;
        const el = thumbnailRefs.current[i];
        if (!el) continue;
        try {
          const canvas = await html2canvas(el, {
            scale: 0.5,
            useCORS: true,
            allowTaint: false,
            logging: false,
            backgroundColor: "#ffffff",
          });
          const dataUrl = canvas.toDataURL("image/jpeg", 0.82);
          if (!cancelled) {
            setThumbnailImages((prev) => {
              const next = [...prev];
              next[i] = dataUrl;
              return next;
            });
          }
        } catch {
          // leave null; fallback text shows instead
        }
      }
    };

    captureAll();
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [liveDeck]);

  const handleExportPDF = async () => {
    if (exportingPdf || !liveDeck) return;
    setExportingPdf(true);
    setExportDropdownOpen(false);
    try {
      await exportToPdf(liveDeck);
    } catch (err) {
      console.error("PDF export failed:", err);
      alert("Failed to export PDF. Please try again.");
    } finally {
      setExportingPdf(false);
    }
  };

  const handleExportPPTX = async () => {
    if (exportingPptx || !liveDeck) return;
    setExportingPptx(true);
    setExportDropdownOpen(false);
    try {
      await exportToPptx(liveDeck);
    } catch (err) {
      console.error("PPTX export failed:", err);
      alert("Failed to export PPTX. Please try again.");
    } finally {
      setExportingPptx(false);
    }
  };

  const handleExportGoogleSlides = async () => {
    if (exportingPptx || !liveDeck) return;
    setExportingPptx(true);
    setExportDropdownOpen(false);
    try {
      await exportToPptx(liveDeck);
      setGoogleSlidesNotice(true);
      setTimeout(() => setGoogleSlidesNotice(false), 7000);
    } catch (err) {
      console.error("Google Slides export failed:", err);
      alert("Failed to export. Please try again.");
    } finally {
      setExportingPptx(false);
    }
  };

  const handleExportPNG = async () => {
    if (exportingPng || !slideContainerRef.current) return;
    setExportingPng(true);
    setExportDropdownOpen(false);
    try {
      const safeName = (liveDeck?.deck_title || "lesson")
        .replace(/[^a-zA-Z0-9\s-]/g, "")
        .replace(/\s+/g, "_")
        .slice(0, 40);
      await exportSlideToPng(
        slideContainerRef.current,
        `${safeName}_slide_${activeIndex + 1}.png`
      );
    } catch (err) {
      console.error("PNG export failed:", err);
      alert("Failed to export PNG. Please try again.");
    } finally {
      setExportingPng(false);
    }
  };

  const handlePresent = () => {
    console.log("[SlideViewer] Present mode requested", { deck: liveDeck });
  };

  const metadata = useMemo(
    () => ({
      deckTitle: liveDeck?.deck_title ?? "Untitled lesson",
      subject: liveDeck?.subject ?? "-",
      grade: liveDeck?.grade ?? "-",
      bloomLevel: liveDeck?.bloom_level ?? "-",
    }),
    [liveDeck]
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
            {/* Export dropdown */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setExportDropdownOpen((o) => !o)}
                disabled={exportingPdf || exportingPptx || exportingPng}
                className={[
                  "flex items-center gap-1.5 rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm font-semibold text-gray-700 transition",
                  "hover:border-gray-300 hover:bg-gray-50",
                  "disabled:cursor-not-allowed disabled:opacity-50",
                ].join(" ")}
              >
                {exportingPdf || exportingPptx || exportingPng ? "Exporting…" : "Export"}
                <svg viewBox="0 0 10 6" width="10" height="10" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="opacity-60">
                  <path d="M1 1l4 4 4-4" />
                </svg>
              </button>

              {exportDropdownOpen && (
                <>
                  {/* Backdrop to close on outside click */}
                  <div
                    className="fixed inset-0 z-30"
                    onClick={() => setExportDropdownOpen(false)}
                  />
                  <div className="absolute right-0 top-full z-40 mt-1.5 w-52 overflow-hidden rounded-xl border border-gray-200 bg-white shadow-lg">
                    <ExportMenuItem
                      icon="📄"
                      label="Export PDF"
                      sublabel="All slides, split layout"
                      onClick={handleExportPDF}
                    />
                    <ExportMenuItem
                      icon="📊"
                      label="Export PPTX"
                      sublabel="PowerPoint format"
                      onClick={handleExportPPTX}
                    />
                    <ExportMenuItem
                      icon="🇬"
                      label="Google Slides"
                      sublabel="Download PPTX, then import"
                      onClick={handleExportGoogleSlides}
                    />
                    <div className="my-1 border-t border-gray-100" />
                    <ExportMenuItem
                      icon="🖼️"
                      label="Export PNG"
                      sublabel={`Current slide (${activeIndex + 1})`}
                      onClick={handleExportPNG}
                    />
                  </div>
                </>
              )}
            </div>

            <ToolbarButton onClick={handlePresent} label="Present" primary />
          </div>
        </header>

        {/* Google Slides import notice */}
        {googleSlidesNotice && (
          <div className="rounded-xl border border-blue-200 bg-blue-50 px-5 py-3 text-sm text-blue-800">
            <span className="font-semibold">PPTX downloaded.</span> To open in Google Slides: go to{" "}
            <span className="font-mono text-blue-700">drive.google.com</span> → New → File upload → select the .pptx file → Open with Google Slides.
          </div>
        )}

        <section className="relative flex w-full items-center justify-center px-12">
          <StageNavButton direction="prev" disabled={!canGoPrev} onClick={goPrev} />

          <div ref={slideContainerRef} className="w-full" data-slide={activeIndex}>
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
            of {totalSlides} - {getSlideTypeLabel(activeSlide)}
          </p>
          <div className="flex items-center gap-2">
            <SecondaryButton onClick={goPrev} disabled={!canGoPrev} label="Previous" />
            <SecondaryButton onClick={goNext} disabled={!canGoNext} label="Next" primary />
          </div>
        </div>

        <SlideEditor
          slide={activeSlide}
          canMoveUp={canGoPrev}
          canMoveDown={canGoNext}
          onPatch={patchActiveSlide}
          onReplace={replaceActiveSlide}
          onMove={moveActiveSlide}
        />

        {/* Hidden off-screen renders used only for html2canvas thumbnail capture */}
        <div
          aria-hidden
          style={{
            position: "fixed",
            left: "-9999px",
            top: 0,
            pointerEvents: "none",
            zIndex: -100,
          }}
        >
          {slides.map((slide, i) => (
            <div
              key={`thumb-render-${i}`}
              ref={(el) => { thumbnailRefs.current[i] = el; }}
              style={{ width: "800px" }}
            >
              <SlideWrapper
                deckTitle={metadata.deckTitle}
                slideTypeLabel={getSlideTypeLabel(slide)}
                slideNumber={i + 1}
                totalSlides={totalSlides}
              >
                {renderSlide(slide)}
              </SlideWrapper>
            </div>
          ))}
        </div>

        <div className="-mx-2 overflow-x-auto pb-2">
          <ol className="flex min-w-max gap-3 px-2">
            {slides.map((slide, i) => {
              const isActive = i === activeIndex;
              const thumbImg = thumbnailImages[i] ?? null;
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
                      className="relative w-full overflow-hidden bg-gradient-to-br from-white to-gray-50"
                      style={{ aspectRatio: "16 / 9" }}
                    >
                      {thumbImg ? (
                        <img
                          src={thumbImg}
                          alt={`Slide ${i + 1} preview`}
                          className="absolute inset-0 h-full w-full object-cover"
                          draggable={false}
                        />
                      ) : (
                        <div className="flex h-full w-full flex-col justify-center px-3">
                          <p className="line-clamp-3 text-[11px] font-semibold leading-tight text-gray-800">
                            {getSlideHeadline(slide)}
                          </p>
                        </div>
                      )}
                      <div className="absolute left-2 top-2 rounded-md bg-black/70 px-1.5 py-0.5 text-[10px] font-semibold text-white">
                        {i + 1}
                      </div>
                      {isActive && (
                        <div className="absolute inset-0 ring-2 ring-inset ring-purple-500/25" />
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

function ExportMenuItem({
  icon,
  label,
  sublabel,
  onClick,
}: {
  icon: string;
  label: string;
  sublabel: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-center gap-3 px-4 py-2.5 text-left transition hover:bg-gray-50"
    >
      <span className="text-base leading-none">{icon}</span>
      <div>
        <p className="text-sm font-semibold text-gray-800">{label}</p>
        <p className="text-[11px] text-gray-400">{sublabel}</p>
      </div>
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

function SlideEditor({
  slide,
  canMoveUp,
  canMoveDown,
  onPatch,
  onReplace,
  onMove,
}: {
  slide: Slide;
  canMoveUp: boolean;
  canMoveDown: boolean;
  onPatch: (patch: Record<string, unknown>) => void;
  onReplace: (slide: Slide) => void;
  onMove: (direction: -1 | 1) => void;
}) {
  const titleConfig = getTitleEditConfig(slide);
  const bodyConfig = getBodyEditConfig(slide);
  const listConfig = getListEditConfig(slide);

  return (
    <section className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-purple-700">
            Edit Slide
          </p>
          <p className="mt-1 text-sm text-gray-500">
            Changes update the preview and exports immediately.
          </p>
        </div>
        <div className="flex gap-2">
          <SecondaryButton
            label="Move up"
            onClick={() => onMove(-1)}
            disabled={!canMoveUp}
          />
          <SecondaryButton
            label="Move down"
            onClick={() => onMove(1)}
            disabled={!canMoveDown}
          />
        </div>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-3 lg:grid-cols-2">
        {titleConfig ? (
          <EditorField label={titleConfig.label}>
            <input
              value={titleConfig.value}
              onChange={(event) => onPatch({ [titleConfig.key]: event.target.value })}
              className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm text-gray-900 outline-none focus:border-purple-400"
            />
          </EditorField>
        ) : null}

        {bodyConfig ? (
          <EditorField label={bodyConfig.label}>
            <textarea
              rows={3}
              value={bodyConfig.value}
              onChange={(event) => onPatch({ [bodyConfig.key]: event.target.value })}
              className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm text-gray-900 outline-none focus:border-purple-400"
            />
          </EditorField>
        ) : null}
      </div>

      {listConfig ? (
        <EditorField label={listConfig.label} className="mt-3">
          <textarea
            rows={5}
            value={listConfig.value}
            onChange={(event) => onReplace(listConfig.toSlide(event.target.value))}
            className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm text-gray-900 outline-none focus:border-purple-400"
          />
          <p className="mt-1 text-xs text-gray-400">Use one item per line.</p>
        </EditorField>
      ) : null}
    </section>
  );
}

function EditorField({
  label,
  children,
  className = "",
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <label className={`block ${className}`}>
      <span className="mb-1 block text-xs font-semibold text-gray-600">{label}</span>
      {children}
    </label>
  );
}

function getTitleEditConfig(slide: Slide): { key: string; label: string; value: string } | null {
  if ("title" in slide) return { key: "title", label: "Title", value: slide.title ?? "" };
  if (slide.type === "check_for_understanding") {
    return { key: "question", label: "Question", value: slide.question ?? "" };
  }
  if (slide.type === "discussion") {
    return { key: "prompt", label: "Prompt", value: slide.prompt ?? "" };
  }
  return null;
}

function getBodyEditConfig(slide: Slide): { key: string; label: string; value: string } | null {
  switch (slide.type) {
    case "title":
      return { key: "subtitle", label: "Subtitle", value: slide.subtitle ?? "" };
    case "concept":
      return { key: "explanation", label: "Explanation", value: slide.explanation ?? "" };
    case "check_for_understanding":
      return { key: "explanation", label: "Explanation", value: slide.explanation ?? "" };
    case "exit_ticket":
      return { key: "prompt", label: "Reflection prompt", value: slide.prompt ?? "" };
    default:
      return null;
  }
}

function getListEditConfig(
  slide: Slide
): { label: string; value: string; toSlide: (value: string) => Slide } | null {
  const lines = (value: string) =>
    value
      .split(/\r?\n/)
      .map((item) => item.trim())
      .filter(Boolean);

  switch (slide.type) {
    case "learning_objectives":
      return {
        label: "Objectives",
        value: (slide.objectives ?? []).join("\n"),
        toSlide: (value) => ({ ...slide, objectives: lines(value) }),
      };
    case "summary":
      return {
        label: "Takeaways",
        value: (slide.takeaways ?? []).join("\n"),
        toSlide: (value) => ({ ...slide, takeaways: lines(value) }),
      };
    case "discussion":
      return {
        label: "Guiding questions",
        value: (slide.guiding_questions ?? []).join("\n"),
        toSlide: (value) => ({ ...slide, guiding_questions: lines(value) }),
      };
    case "exit_ticket":
      return {
        label: "Sentence starters",
        value: (slide.sentence_starters ?? []).join("\n"),
        toSlide: (value) => ({ ...slide, sentence_starters: lines(value) }),
      };
    case "worked_example":
      return {
        label: "Steps",
        value: (slide.steps ?? []).map((step) => step.instruction ?? "").join("\n"),
        toSlide: (value) => ({
          ...slide,
          steps: lines(value).map((instruction, index) => ({
            step_num: index + 1,
            instruction,
            tip: slide.steps?.[index]?.tip,
          })),
        }),
      };
    case "vocabulary":
      return {
        label: "Vocabulary terms",
        value: (slide.terms ?? [])
          .map((term) => `${term.word || "Term"}: ${term.definition || ""}`)
          .join("\n"),
        toSlide: (value) => ({
          ...slide,
          terms: lines(value).map((item, index) => {
            const [word, ...definitionParts] = item.split(":");
            return {
              word: word.trim() || `Term ${index + 1}`,
              definition: definitionParts.join(":").trim(),
              example: slide.terms?.[index]?.example,
            };
          }),
        }),
      };
    case "check_for_understanding":
      return {
        label: "Choices",
        value: (slide.choices ?? [])
          .map((choice) => `${choice.label || ""} ${choice.text || ""}`.trim())
          .join("\n"),
        toSlide: (value) => ({
          ...slide,
          choices: lines(value).map((text, index) => ({
            label: String.fromCharCode(65 + index),
            text: text.replace(/^[A-Z][).:\s-]+/i, "").trim(),
            is_correct: slide.choices?.[index]?.is_correct ?? index === 0,
          })),
        }),
      };
    default:
      return null;
  }
}
