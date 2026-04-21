"use client";

import React from "react";

type ConceptSlideProps = {
  slide: {
    type: "concept";
    title: string;
    explanation: string;
    key_point?: string;
    analogy?: string;
    visual_suggestion: string;
    visual_type: "diagram";
  };
};

export default function ConceptSlide({ slide }: ConceptSlideProps) {
  return (
    <div className="flex h-full w-full flex-col">
      {/* Main content area with split layout */}
      <div className="flex flex-1 flex-col lg:flex-row">
        {/* Left: Content */}
        <div className="flex-1 px-8 py-6">
          <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-purple-200 bg-purple-50 px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.15em] text-purple-700">
            <span className="h-1.5 w-1.5 rounded-full bg-purple-500" />
            Core Concept
          </div>

          <h2 className="text-3xl font-semibold tracking-tight text-gray-900">
            {slide.title}
          </h2>

          <div className="mt-6 space-y-6">
            {/* Explanation */}
            <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
              <p className="text-lg leading-relaxed text-gray-700">
                {slide.explanation}
              </p>
            </div>

            {/* Analogy if present */}
            {slide.analogy && (
              <div className="rounded-xl border-l-4 border-purple-500 bg-purple-50/60 px-5 py-4">
                <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-purple-700">
                  Analogy
                </p>
                <p className="mt-1 text-base italic leading-relaxed text-gray-700">
                  {slide.analogy}
                </p>
              </div>
            )}

            {/* Key point if present */}
            {slide.key_point && (
              <div className="rounded-xl border border-amber-200 bg-gradient-to-br from-amber-50 to-white p-5">
                <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-amber-700">
                  Key Point
                </p>
                <p className="mt-2 text-lg font-medium leading-relaxed text-gray-900">
                  {slide.key_point}
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Right: Visual panel - diagram style, prominent */}
        {slide.visual_type === "diagram" && (
          <div className="w-full border-t border-gray-100 bg-gradient-to-br from-gray-50 to-white p-6 lg:w-96 lg:border-t-0 lg:border-l">
            <div className="h-full flex flex-col">
              <p className="mb-4 text-[10px] font-semibold uppercase tracking-[0.18em] text-gray-500">
                Visual Guide
              </p>
              <div className="flex-1 rounded-xl border-2 border-dashed border-gray-300 bg-white p-4">
                <div className="flex h-full flex-col items-center justify-center text-center">
                  <div className="mb-3 rounded-lg bg-purple-100 px-3 py-1.5 text-xs font-semibold text-purple-700">
                    Diagram / Illustration
                  </div>
                  <p className="text-sm leading-relaxed text-gray-600">
                    {slide.visual_suggestion}
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}