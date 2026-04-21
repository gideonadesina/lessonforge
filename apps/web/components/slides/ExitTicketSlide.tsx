"use client";

import React from "react";

type ExitTicketSlideProps = {
  slide: {
    type: "exit_ticket";
    title: string;
    prompt: string;
    sentence_starters?: string[];
    self_rating?: boolean;
    visual_suggestion: string;
    visual_type: "support";
  };
};

export default function ExitTicketSlide({ slide }: ExitTicketSlideProps) {
  return (
    <div className="flex h-full w-full flex-col px-8 py-6">
      {/* Header */}
      <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-purple-200 bg-purple-50 px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.15em] text-purple-700">
        <span className="h-1.5 w-1.5 rounded-full bg-purple-500" />
        Exit Ticket
      </div>

      <h2 className="text-3xl font-semibold tracking-tight text-gray-900">
        {slide.title}
      </h2>

      {/* Prompt */}
      <div className="mt-6 flex-shrink-0 rounded-2xl border border-gray-200 bg-gradient-to-br from-purple-50/40 to-white p-6 shadow-sm">
        <p className="text-lg leading-relaxed text-gray-800">
          {slide.prompt}
        </p>
      </div>

      {/* Sentence starters */}
      {slide.sentence_starters && slide.sentence_starters.length > 0 && (
        <div className="mt-4 flex-shrink-0">
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-gray-500">
            Sentence Starters
          </p>
          <ul className="mt-2 space-y-2">
            {slide.sentence_starters.map((starter, index) => (
              <li
                key={index}
                className="rounded-lg border border-dashed border-gray-300 bg-white px-4 py-2 text-sm italic text-gray-700"
              >
                {starter} ___________________
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Self rating */}
      {slide.self_rating && (
        <div className="mt-4 flex-shrink-0 flex items-center gap-3 rounded-xl border border-gray-200 bg-white px-5 py-3 shadow-sm">
          <p className="text-sm font-medium text-gray-700">
            Rate your confidence:
          </p>
          <div className="flex items-center gap-2">
            {[1, 2, 3, 4, 5].map((num) => (
              <button
                key={num}
                type="button"
                className="flex h-8 w-8 items-center justify-center rounded-md border border-gray-200 bg-gray-50 text-sm font-semibold text-gray-600 transition hover:border-purple-300 hover:bg-purple-50 hover:text-purple-700"
              >
                {num}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Visual suggestion - support style */}
      <div className="mt-auto flex-shrink-0 border-t border-gray-100 pt-4">
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