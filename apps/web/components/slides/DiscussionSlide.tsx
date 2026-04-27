"use client";

import React from "react";
import SlideVisualPanel, { resolveSlideImageUrl } from "./SlideVisualPanel";

type DiscussionSlideProps = {
  slide: {
    type: "discussion";
    prompt: string;
    guiding_questions?: string[];
    think_pair_share?: boolean;
    visual_suggestion?: string;
    visual_type: "support";
    image_url?: string | null;
    image?: string | null;
  };
};

export default function DiscussionSlide({ slide }: DiscussionSlideProps) {
  const questions = Array.isArray(slide.guiding_questions) ? slide.guiding_questions : [];

  return (
    <div className="grid h-full w-full grid-cols-1 bg-[linear-gradient(135deg,#ffffff_0%,#f7f4ff_60%,#eefdf5_100%)] lg:grid-cols-[0.95fr_1.05fr]">
      <SlideVisualPanel
        imageUrl={resolveSlideImageUrl(slide)}
        alt={slide.visual_suggestion || slide.prompt}
        suggestion={slide.visual_suggestion}
        label="Discussion Visual"
      />

      <div className="flex h-full flex-col justify-center px-12 py-12">
        <div className="mb-6 flex items-center justify-between gap-3">
          <div className="inline-flex items-center gap-2 rounded-full border border-purple-200 bg-purple-50 px-4 py-2 text-xs font-bold uppercase tracking-[0.18em] text-purple-700">
            <span className="h-2 w-2 rounded-full bg-purple-500" />
            Discussion
          </div>
          {slide.think_pair_share && (
            <span className="rounded-full border border-purple-200 bg-white px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-purple-700 shadow-sm">
              Think Pair Share
            </span>
          )}
        </div>

        <div className="rounded-3xl bg-[linear-gradient(135deg,#171721_0%,#2a235f_100%)] px-7 py-8 text-white shadow-[0_25px_70px_-35px_rgba(17,17,39,0.8)]">
          <p className="text-xs font-bold uppercase tracking-[0.22em] text-purple-200">
            Prompt
          </p>
          <p className="mt-4 text-4xl font-extrabold leading-tight tracking-tight">
            &quot;{slide.prompt}&quot;
          </p>
        </div>

        {questions.length > 0 ? (
          <div className="mt-5 grid grid-cols-1 gap-3">
            {questions.slice(0, 3).map((question, index) => (
              <div
                key={index}
                className="flex items-start gap-3 rounded-2xl border border-white bg-white/88 px-5 py-4 shadow-[0_18px_45px_-34px_rgba(17,17,39,0.45)]"
              >
                <span className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-xl bg-purple-100 text-sm font-black text-purple-700">
                  Q{index + 1}
                </span>
                <span className="text-base font-medium leading-relaxed text-gray-800">
                  {question}
                </span>
              </div>
            ))}
          </div>
        ) : (
          <div className="mt-5 rounded-2xl border border-dashed border-gray-200 bg-gray-50 px-5 py-4">
            <p className="text-sm font-medium text-gray-600">
              Use the prompt to surface evidence, examples, and opposing viewpoints.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
