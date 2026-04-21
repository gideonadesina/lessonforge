"use client";

import React from "react";

type TitleSlideProps = {
  slide: {
    type: "title";
    title: string;
    subtitle?: string;
    hook_question?: string;
    visual_suggestion: string;
    visual_type: "hero";
  };
};

export default function TitleSlide({ slide }: TitleSlideProps) {
  return (
    <div className="flex h-full w-full flex-col">
      {/* Hero visual area - image-dominant */}
      {slide.visual_type === "hero" && slide.visual_suggestion && (
        <div className="relative w-full flex-1 overflow-hidden bg-gradient-to-br from-purple-50 via-white to-purple-100/30">
          <div className="absolute inset-0 flex items-center justify-center p-8">
            <div className="max-w-2xl text-center">
              <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-purple-200 bg-purple-50 px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-purple-700">
                <span className="h-2 w-2 rounded-full bg-purple-500" />
                Lesson Opener
              </div>
              <h1 className="text-4xl font-semibold leading-tight tracking-tight text-gray-900 md:text-5xl lg:text-6xl">
                {slide.title}
              </h1>
              {slide.subtitle && (
                <p className="mt-4 text-xl font-light leading-relaxed text-gray-600">
                  {slide.subtitle}
                </p>
              )}
            </div>
          </div>
          {/* Visual suggestion hint at bottom */}
          <div className="absolute bottom-4 left-4 right-4">
            <div className="flex items-start gap-2 rounded-lg border border-dashed border-purple-200 bg-white/80 px-3 py-2 text-xs text-purple-700 backdrop-blur">
              <span className="mt-0.5 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-purple-400" />
              <span>
                <span className="font-semibold">Visual:</span> {slide.visual_suggestion}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Hook question section */}
      {slide.hook_question && (
        <div className="flex-shrink-0 border-t border-gray-100 bg-gradient-to-r from-purple-50/50 to-white px-8 py-6">
          <div className="rounded-xl border border-purple-100 bg-white px-6 py-4 shadow-sm">
            <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-purple-600">
              Hook Question
            </p>
            <p className="mt-2 text-lg font-medium italic text-gray-800">
              "{slide.hook_question}"
            </p>
          </div>
        </div>
      )}
    </div>
  );
}