"use client";

import React from "react";

type LearningObjectivesSlideProps = {
  slide: {
    type: "learning_objectives";
    title: string;
    objectives: string[];
    bloom_level?: string;
    visual_suggestion: string;
    visual_type: "support";
  };
};

export default function LearningObjectivesSlide({ slide }: LearningObjectivesSlideProps) {
  return (
    <div className="flex h-full w-full flex-col px-8 py-6">
      {/* Header with bloom badge */}
      <div className="flex items-start justify-between">
        <div className="inline-flex items-center gap-2 rounded-full border border-purple-200 bg-purple-50 px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.15em] text-purple-700">
          <span className="h-1.5 w-1.5 rounded-full bg-purple-500" />
          Learning Objectives
        </div>
        {slide.bloom_level && (
          <span className="rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-[10px] font-semibold uppercase tracking-wider text-amber-700">
            Bloom · {slide.bloom_level}
          </span>
        )}
      </div>

      {/* Title */}
      <h2 className="mt-5 text-3xl font-semibold tracking-tight text-gray-900">
        {slide.title}
      </h2>
      <p className="mt-1 text-sm text-gray-500">
        By the end of this lesson, learners will be able to:
      </p>

      {/* Objectives as elegant list */}
      <div className="mt-6 flex-1 overflow-auto">
        <div className="grid grid-cols-1 gap-3">
          {slide.objectives.map((objective, index) => (
            <div
              key={index}
              className="flex items-start gap-4 rounded-xl border border-gray-200 bg-white px-5 py-4 shadow-sm transition hover:border-purple-300 hover:shadow-md"
            >
              <span className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-purple-600 text-sm font-semibold text-white shadow-sm">
                {index + 1}
              </span>
              <span className="text-base leading-relaxed text-gray-800">
                {objective}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Visual suggestion - support style */}
      <div className="flex-shrink-0 border-t border-gray-100 pt-4">
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