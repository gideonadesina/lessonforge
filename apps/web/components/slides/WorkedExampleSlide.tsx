"use client";

import React from "react";
import SlideVisualPanel, { resolveSlideImageUrl } from "./SlideVisualPanel";

type WorkedExampleSlideProps = {
  slide: {
    type: "worked_example";
    title: string;
    steps?: { step_num?: number; instruction?: string; tip?: string }[];
    visual_suggestion?: string;
    visual_type: "diagram";
    image_url?: string | null;
    image?: string | null;
  };
};

export default function WorkedExampleSlide({ slide }: WorkedExampleSlideProps) {
  const steps = Array.isArray(slide.steps) ? slide.steps : [];

  return (
    <div className="grid h-full w-full grid-cols-1 bg-[linear-gradient(135deg,#ffffff_0%,#fbfaff_52%,#fff8e8_100%)] lg:grid-cols-[1.08fr_0.92fr]">
      <div className="flex h-full flex-col justify-center px-12 py-12">
        <div className="mb-5 inline-flex w-fit items-center gap-2 rounded-full border border-purple-200 bg-purple-50 px-4 py-2 text-xs font-bold uppercase tracking-[0.18em] text-purple-700">
          <span className="h-2 w-2 rounded-full bg-purple-500" />
          Worked Example
        </div>

        <h2 className="text-5xl font-black leading-tight tracking-tight text-gray-950">
          {slide.title}
        </h2>

        <div className="mt-7 space-y-3">
          {steps.slice(0, 5).map((step, index) => (
            <div
              key={index}
              className="flex items-start gap-4 rounded-2xl border border-white bg-white/88 px-5 py-4 shadow-[0_18px_45px_-34px_rgba(17,17,39,0.45)]"
            >
              <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-gray-950 text-sm font-black text-white">
                {step.step_num ?? index + 1}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-base font-medium leading-relaxed text-gray-800">
                  {step.instruction || "Step unavailable."}
                </p>
                {step.tip && (
                  <div className="mt-2 rounded-xl bg-amber-50 px-3 py-2">
                    <p className="text-xs font-semibold text-amber-800">
                      Tip: {step.tip}
                    </p>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      <SlideVisualPanel
        imageUrl={resolveSlideImageUrl(slide)}
        alt={slide.visual_suggestion || slide.title}
        suggestion={slide.visual_suggestion}
        label="Worked Visual"
      />
    </div>
  );
}
