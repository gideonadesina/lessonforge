"use client";

import React from "react";

type WorkedExampleSlideProps = {
  slide: {
    type: "worked_example";
    title: string;
    steps: { step_num: number; instruction: string; tip?: string }[];
    visual_suggestion: string;
    visual_type: "diagram";
  };
};

export default function WorkedExampleSlide({ slide }: WorkedExampleSlideProps) {
  return (
    <div className="flex h-full w-full flex-col">
      {/* Main content area */}
      <div className="flex flex-1 flex-col lg:flex-row">
        {/* Left: Steps */}
        <div className="flex-1 px-8 py-6">
          <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-purple-200 bg-purple-50 px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.15em] text-purple-700">
            <span className="h-1.5 w-1.5 rounded-full bg-purple-500" />
            Worked Example
          </div>

          <h2 className="text-3xl font-semibold tracking-tight text-gray-900">
            {slide.title}
          </h2>

          {/* Steps */}
          <div className="mt-6 space-y-3">
            {slide.steps.map((step, index) => (
              <div
                key={index}
                className="flex items-start gap-4 rounded-xl border border-gray-200 bg-white px-5 py-4 shadow-sm"
              >
                <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg bg-gray-900 text-sm font-semibold text-white">
                  {step.step_num}
                </div>
                <div className="flex-1">
                  <p className="text-base leading-relaxed text-gray-800">
                    {step.instruction}
                  </p>
                  {step.tip && (
                    <div className="mt-2 flex items-start gap-2 rounded-lg bg-amber-50 px-3 py-2">
                      <span className="mt-0.5 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-amber-500" />
                      <p className="text-xs font-medium text-amber-800">
                        Tip: {step.tip}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Right: Visual panel - diagram style, strong */}
        {slide.visual_type === "diagram" && (
          <div className="w-full border-t border-gray-100 bg-gradient-to-br from-gray-50 to-white p-6 lg:w-96 lg:border-t-0 lg:border-l">
            <div className="h-full flex flex-col">
              <p className="mb-4 text-[10px] font-semibold uppercase tracking-[0.18em] text-gray-500">
                Visual Support
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