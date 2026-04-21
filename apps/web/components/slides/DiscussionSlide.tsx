"use client";

import React from "react";

type DiscussionSlideProps = {
  slide: {
    type: "discussion";
    prompt: string;
    guiding_questions?: string[];
    think_pair_share?: boolean;
    visual_suggestion: string;
    visual_type: "support";
  };
};

export default function DiscussionSlide({ slide }: DiscussionSlideProps) {
  return (
    <div className="flex h-full w-full flex-col px-8 py-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="inline-flex items-center gap-2 rounded-full border border-purple-200 bg-purple-50 px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.15em] text-purple-700">
          <span className="h-1.5 w-1.5 rounded-full bg-purple-500" />
          Discussion
        </div>
        {slide.think_pair_share && (
          <span className="rounded-full border border-purple-200 bg-white px-3 py-1 text-[10px] font-semibold uppercase tracking-wider text-purple-700 shadow-sm">
            Think · Pair · Share
          </span>
        )}
      </div>

      {/* Main prompt - centered */}
      <div className="mt-8 flex flex-1 items-center justify-center">
        <div className="text-center">
          <p className="text-3xl font-medium leading-snug text-gray-900">
            "{slide.prompt}"
          </p>
        </div>
      </div>

      {/* Guiding questions */}
      {slide.guiding_questions && slide.guiding_questions.length > 0 && (
        <div className="mt-6 grid grid-cols-1 gap-2 md:grid-cols-3">
          {slide.guiding_questions.map((question, index) => (
            <div
              key={index}
              className="rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm leading-relaxed text-gray-700 shadow-sm"
            >
              <span className="mr-2 text-xs font-semibold text-purple-600">
                Q{index + 1}
              </span>
              {question}
            </div>
          ))}
        </div>
      )}

      {/* Visual suggestion - support style */}
      <div className="mt-4 flex-shrink-0 border-t border-gray-100 pt-4">
        <div className="flex items-start gap-2 rounded-lg border border-dashed border-gray-200 bg-gray-50/70 px-3 py-2 text-xs text-gray-500">
          <span className="mt-0.5 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-amber-400" />
          <span>
            <span className="font-semibold text-gray-600">Visual:</span> {slide.visual_suggestion}
          </span>
        </div>
      </div>
    </div>
  );
}