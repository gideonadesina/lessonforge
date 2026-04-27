"use client";

import React from "react";
import SlideVisualPanel, { resolveSlideImageUrl } from "./SlideVisualPanel";

type VocabularySlideProps = {
  slide: {
    type: "vocabulary";
    title: string;
    terms?: { word?: string; term?: string; name?: string; definition?: string; example?: string }[];
    visual_suggestion?: string;
    visual_type: "support";
    image_url?: string | null;
    image?: string | null;
  };
};

export default function VocabularySlide({ slide }: VocabularySlideProps) {
  const terms = Array.isArray(slide.terms) ? slide.terms : [];

  return (
    <div className="grid h-full w-full grid-cols-1 bg-[linear-gradient(135deg,#ffffff_0%,#f8fbff_55%,#f7f0ff_100%)] lg:grid-cols-[1.1fr_0.9fr]">
      <div className="flex h-full flex-col justify-center px-12 py-12">
        <div className="mb-5 inline-flex w-fit items-center gap-2 rounded-full border border-purple-200 bg-purple-50 px-4 py-2 text-xs font-bold uppercase tracking-[0.18em] text-purple-700">
          <span className="h-2 w-2 rounded-full bg-purple-500" />
          Key Vocabulary
        </div>

        <h2 className="text-5xl font-black leading-tight tracking-tight text-gray-950">
          {slide.title}
        </h2>

        <div className="mt-7 grid grid-cols-1 gap-3 md:grid-cols-2">
          {terms.slice(0, 6).map((term, index) => (
            <div
              key={index}
              className="rounded-2xl border border-white bg-white/88 p-4 shadow-[0_18px_45px_-32px_rgba(17,17,39,0.45)]"
            >
              <div className="flex items-center gap-3">
                <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl bg-purple-600 text-sm font-bold text-white">
                  {String.fromCharCode(65 + index)}
                </span>
                <p className="text-lg font-extrabold text-gray-950">
                  {term.word || term.term || term.name || "Term"}
                </p>
              </div>
              <p className="mt-3 line-clamp-3 text-sm leading-relaxed text-gray-700">
                {term.definition || "Definition unavailable."}
              </p>
              {term.example && (
                <div className="mt-3 rounded-xl bg-amber-50 px-3 py-2">
                  <p className="line-clamp-2 text-xs italic text-amber-900">
                    <span className="font-semibold">e.g.</span> {term.example}
                  </p>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      <SlideVisualPanel
        imageUrl={resolveSlideImageUrl(slide)}
        alt={slide.visual_suggestion || slide.title}
        suggestion={slide.visual_suggestion}
        label="Vocabulary Context"
      />
    </div>
  );
}
