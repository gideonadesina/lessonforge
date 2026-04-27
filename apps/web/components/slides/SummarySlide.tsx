"use client";

import React from "react";
import SlideVisualPanel, { resolveSlideImageUrl } from "./SlideVisualPanel";

type SummarySlideProps = {
  slide: {
    type: "summary";
    title: string;
    takeaways?: string[];
    connection_to_next?: string;
    visual_suggestion?: string;
    visual_type: "support";
    image_url?: string | null;
    image?: string | null;
  };
};

export default function SummarySlide({ slide }: SummarySlideProps) {
  const takeaways = Array.isArray(slide.takeaways) ? slide.takeaways : [];

  return (
    <div className="grid h-full w-full grid-cols-1 bg-[linear-gradient(135deg,#ffffff_0%,#f7fbff_55%,#f5efff_100%)] lg:grid-cols-[1.05fr_0.95fr]">
      <div className="flex h-full flex-col justify-center px-12 py-12">
        <div className="mb-5 inline-flex w-fit items-center gap-2 rounded-full border border-purple-200 bg-purple-50 px-4 py-2 text-xs font-bold uppercase tracking-[0.18em] text-purple-700">
          <span className="h-2 w-2 rounded-full bg-purple-500" />
          Lesson Recap
        </div>

        <h2 className="text-5xl font-black leading-tight tracking-tight text-gray-950">
          {slide.title}
        </h2>

        <div className="mt-7 grid grid-cols-1 gap-3">
          {takeaways.slice(0, 5).map((takeaway, index) => (
            <div
              key={index}
              className="flex items-start gap-4 rounded-2xl border border-white bg-white/88 px-5 py-4 shadow-[0_18px_45px_-34px_rgba(17,17,39,0.45)]"
            >
              <span className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-xl bg-gray-950 text-sm font-black text-white">
                {index + 1}
              </span>
              <span className="text-base font-medium leading-relaxed text-gray-800">
                {takeaway}
              </span>
            </div>
          ))}
        </div>

        {slide.connection_to_next && (
          <div className="mt-5 rounded-2xl border border-amber-200 bg-amber-50 px-5 py-4">
            <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-amber-700">
              Next Lesson
            </p>
            <p className="mt-1 text-sm font-medium leading-relaxed text-gray-800">
              {slide.connection_to_next}
            </p>
          </div>
        )}
      </div>

      <SlideVisualPanel
        imageUrl={resolveSlideImageUrl(slide)}
        alt={slide.visual_suggestion || slide.title}
        suggestion={slide.visual_suggestion}
        label="Recap Visual"
      />
    </div>
  );
}
