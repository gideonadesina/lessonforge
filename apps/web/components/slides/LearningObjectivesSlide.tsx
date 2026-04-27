"use client";

import React from "react";
import SlideVisualPanel, { resolveSlideImageUrl } from "./SlideVisualPanel";

type LearningObjectivesSlideProps = {
  slide: {
    type: "learning_objectives";
    title: string;
    objectives?: string[];
    bloom_level?: string;
    visual_suggestion?: string;
    visual_type: "support";
    image_url?: string | null;
    image?: string | null;
  };
};

export default function LearningObjectivesSlide({ slide }: LearningObjectivesSlideProps) {
  const objectives = Array.isArray(slide.objectives) ? slide.objectives : [];

  return (
    <div className="grid h-full w-full grid-cols-1 bg-[linear-gradient(135deg,#ffffff_0%,#fbfaff_55%,#eefdf5_100%)] lg:grid-cols-[1.05fr_0.95fr]">
      <div className="flex h-full flex-col justify-center px-12 py-12">
        <div className="mb-5 flex items-center justify-between gap-3">
          <div className="inline-flex items-center gap-2 rounded-full border border-purple-200 bg-purple-50 px-4 py-2 text-xs font-bold uppercase tracking-[0.18em] text-purple-700">
            <span className="h-2 w-2 rounded-full bg-purple-500" />
            Learning Objectives
          </div>
          {slide.bloom_level && (
            <span className="rounded-full border border-amber-200 bg-amber-50 px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-amber-700">
              Bloom: {slide.bloom_level}
            </span>
          )}
        </div>

        <h2 className="text-5xl font-black leading-tight tracking-tight text-gray-950">
          {slide.title}
        </h2>
        <p className="mt-3 text-base font-medium text-gray-500">
          By the end of this lesson, learners will be able to:
        </p>

        <div className="mt-7 grid grid-cols-1 gap-3">
          {objectives.slice(0, 5).map((objective, index) => (
            <div
              key={index}
              className="flex items-start gap-4 rounded-2xl border border-white bg-white/85 px-5 py-4 shadow-[0_18px_45px_-34px_rgba(17,17,39,0.45)]"
            >
              <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl bg-purple-600 text-sm font-black text-white shadow-sm">
                {index + 1}
              </span>
              <span className="text-base font-medium leading-relaxed text-gray-800">
                {objective}
              </span>
            </div>
          ))}
        </div>
      </div>

      <SlideVisualPanel
        imageUrl={resolveSlideImageUrl(slide)}
        alt={slide.visual_suggestion || slide.title}
        suggestion={slide.visual_suggestion}
        label="Learning Context"
      />
    </div>
  );
}
