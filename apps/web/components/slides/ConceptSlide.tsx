"use client";

import React from "react";
import SlideVisualPanel, { resolveSlideImageUrl } from "./SlideVisualPanel";

type ConceptSlideProps = {
  slide: {
    type: "concept";
    title: string;
    explanation?: string;
    key_point?: string;
    analogy?: string;
    visual_suggestion?: string;
    visual_type: "diagram";
    image_url?: string | null;
    image?: string | null;
  };
};

export default function ConceptSlide({ slide }: ConceptSlideProps) {
  return (
    <div className="grid h-full w-full grid-cols-1 bg-[linear-gradient(135deg,#ffffff_0%,#faf7ff_58%,#f3fbff_100%)] lg:grid-cols-[1.05fr_0.95fr]">
      <div className="flex h-full flex-col justify-center px-12 py-12">
        <div className="mb-5 inline-flex w-fit items-center gap-2 rounded-full border border-purple-200 bg-purple-50 px-4 py-2 text-xs font-bold uppercase tracking-[0.18em] text-purple-700">
          <span className="h-2 w-2 rounded-full bg-purple-500" />
          Core Concept
        </div>

        <h2 className="text-5xl font-black leading-tight tracking-tight text-gray-950">
          {slide.title}
        </h2>

        <p className="mt-6 text-xl font-medium leading-relaxed text-gray-700">
          {slide.explanation || "Concept explanation unavailable."}
        </p>

        {slide.key_point && (
          <div className="mt-7 rounded-3xl border border-amber-200 bg-amber-50/90 p-5 shadow-[0_18px_45px_-34px_rgba(154,106,0,0.45)]">
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-amber-700">
              Key Point
            </p>
            <p className="mt-2 text-lg font-bold leading-relaxed text-gray-950">
              {slide.key_point}
            </p>
          </div>
        )}

        {slide.analogy && (
          <div className="mt-4 rounded-3xl border border-purple-100 border-l-4 border-l-purple-500 bg-purple-50/90 p-5 shadow-[0_18px_45px_-34px_rgba(83,74,183,0.35)]">
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-purple-700">
              Analogy
            </p>
            <p className="mt-2 text-base italic leading-relaxed text-gray-700">
              {slide.analogy}
            </p>
          </div>
        )}
      </div>

      <SlideVisualPanel
        imageUrl={resolveSlideImageUrl(slide)}
        alt={slide.visual_suggestion || slide.title}
        suggestion={slide.visual_suggestion}
      />
    </div>
  );
}
