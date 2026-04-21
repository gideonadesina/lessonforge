"use client";

import React from "react";

type SummarySlideProps = {
  slide: {
    type: "summary";
    title: string;
    takeaways: string[];
    connection_to_next?: string;
    visual_suggestion: string;
    visual_type: "support";
  };
};

export default function SummarySlide({ slide }: SummarySlideProps) {
  return (
    <div className="flex h-full w-full flex-col px-8 py-6">
      {/* Header */}
      <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-purple-200 bg-purple-50 px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.15em] text-purple-700">
        <span className="h-1.5 w-1.5 rounded-full bg-purple-500" />
        Lesson Recap
      </div>

      <h2 className="text-3xl font-semibold tracking-tight text-gray-900">
        {slide.title}
      </h2>

      {/* Takeaways */}
      <div className="mt-6 flex-1 overflow-auto">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          {slide.takeaways.map((takeaway, index) => (
            <div
              key={index}
              className="flex items-start gap-3 rounded-xl border border-gray-200 bg-white px-5 py-4 shadow-sm"
            >
              <span className="mt-[6px] h-2 w-2 flex-shrink-0 rounded-full bg-purple-500" />
              <span className="text-base leading-relaxed text-gray-800">
                {takeaway}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Connection to next */}
      {slide.connection_to_next && (
        <div className="mt-4 flex-shrink-0 rounded-xl border border-amber-200 bg-amber-50/60 px-5 py-4">
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-amber-700">
            Next Lesson
          </p>
          <p className="mt-1 text-sm leading-relaxed text-gray-800">
            {slide.connection_to_next}
          </p>
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