"use client";

import React from "react";
import SlideVisualPanel, { resolveSlideImageUrl } from "./SlideVisualPanel";

type ExitTicketSlideProps = {
  slide: {
    type: "exit_ticket";
    title: string;
    prompt: string;
    sentence_starters?: string[];
    self_rating?: boolean;
    visual_suggestion?: string;
    visual_type: "support";
    image_url?: string | null;
    image?: string | null;
  };
};

export default function ExitTicketSlide({ slide }: ExitTicketSlideProps) {
  const starters = Array.isArray(slide.sentence_starters) ? slide.sentence_starters : [];

  return (
    <div className="grid h-full w-full grid-cols-1 bg-[linear-gradient(135deg,#ffffff_0%,#fbfaff_56%,#fff8e8_100%)] lg:grid-cols-[1.05fr_0.95fr]">
      <div className="flex h-full flex-col justify-center px-12 py-12">
        <div className="mb-5 inline-flex w-fit items-center gap-2 rounded-full border border-purple-200 bg-purple-50 px-4 py-2 text-xs font-bold uppercase tracking-[0.18em] text-purple-700">
          <span className="h-2 w-2 rounded-full bg-purple-500" />
          Exit Ticket
        </div>

        <h2 className="text-5xl font-black leading-tight tracking-tight text-gray-950">
          {slide.title}
        </h2>

        <div className="mt-7 rounded-3xl bg-[linear-gradient(135deg,#171721_0%,#352a78_100%)] px-7 py-8 text-white shadow-[0_25px_70px_-35px_rgba(17,17,39,0.8)]">
          <p className="text-xs font-bold uppercase tracking-[0.22em] text-purple-200">
            Reflection Prompt
          </p>
          <p className="mt-4 text-2xl font-bold leading-snug">
            {slide.prompt}
          </p>
        </div>

        {starters.length > 0 && (
          <div className="mt-5 grid grid-cols-1 gap-2">
            {starters.slice(0, 3).map((starter, index) => (
              <div
                key={index}
                className="rounded-2xl border border-dashed border-gray-300 bg-white/88 px-4 py-3 text-sm italic text-gray-700 shadow-[0_14px_35px_-30px_rgba(17,17,39,0.45)]"
              >
                {starter} ___________________
              </div>
            ))}
          </div>
        )}

        {slide.self_rating && (
          <div className="mt-5 flex items-center gap-3 rounded-2xl border border-gray-200 bg-white px-5 py-4 shadow-sm">
            <p className="text-sm font-bold text-gray-700">Confidence:</p>
            <div className="flex items-center gap-2">
              {[1, 2, 3, 4, 5].map((num) => (
                <button
                  key={num}
                  type="button"
                  className="flex h-9 w-9 items-center justify-center rounded-xl border border-gray-200 bg-gray-50 text-sm font-bold text-gray-600 transition hover:border-purple-300 hover:bg-purple-50 hover:text-purple-700"
                >
                  {num}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      <SlideVisualPanel
        imageUrl={resolveSlideImageUrl(slide)}
        alt={slide.visual_suggestion || slide.title}
        suggestion={slide.visual_suggestion}
        label="Exit Context"
      />
    </div>
  );
}
