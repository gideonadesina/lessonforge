"use client";

import React, { useState } from "react";
import SlideVisualPanel, { resolveSlideImageUrl } from "./SlideVisualPanel";

type CheckForUnderstandingSlideProps = {
  slide: {
    type: "check_for_understanding";
    question: string;
    choices?: { label?: string; text?: string; is_correct?: boolean }[];
    explanation?: string;
    visual_suggestion?: string;
    visual_type: "support";
    image_url?: string | null;
    image?: string | null;
  };
};

export default function CheckForUnderstandingSlide({ slide }: CheckForUnderstandingSlideProps) {
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [showExplanation, setShowExplanation] = useState(false);
  const choices = Array.isArray(slide.choices) ? slide.choices : [];

  const handleSelect = (index: number) => {
    setSelectedIndex(index);
    setShowExplanation(true);
  };

  return (
    <div className="grid h-full w-full grid-cols-1 bg-[linear-gradient(135deg,#ffffff_0%,#fbfaff_58%,#f4fbff_100%)] lg:grid-cols-[1.1fr_0.9fr]">
      <div className="flex h-full flex-col justify-center px-12 py-12">
        <div className="mb-5 inline-flex w-fit items-center gap-2 rounded-full border border-purple-200 bg-purple-50 px-4 py-2 text-xs font-bold uppercase tracking-[0.18em] text-purple-700">
          <span className="h-2 w-2 rounded-full bg-purple-500" />
          Check for Understanding
        </div>

        <h2 className="text-4xl font-black leading-tight tracking-tight text-gray-950">
          {slide.question}
        </h2>

        <div className="mt-7 grid grid-cols-1 gap-3">
          {choices.slice(0, 5).map((choice, index) => {
            const isSelected = selectedIndex === index;
            const isCorrect = !!choice.is_correct;
            const showResult = selectedIndex !== null;

            let borderClass = "border-white bg-white/88 shadow-[0_16px_40px_-32px_rgba(17,17,39,0.5)] hover:border-purple-400";
            let markerClass = "border-gray-200 bg-gray-50 text-gray-700";

            if (showResult && isCorrect) {
              borderClass = "border-emerald-400 bg-emerald-50";
              markerClass = "bg-emerald-500 text-white border-emerald-500";
            } else if (showResult && isSelected && !isCorrect) {
              borderClass = "border-red-400 bg-red-50";
              markerClass = "bg-red-500 text-white border-red-500";
            }

            return (
              <button
                key={index}
                type="button"
                onClick={() => !showResult && handleSelect(index)}
                disabled={showResult}
                className={`group flex w-full items-center gap-4 rounded-2xl border-2 px-5 py-4 text-left transition ${borderClass}`}
              >
                <span
                  className={`flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl border-2 text-sm font-black transition ${markerClass}`}
                >
                  {showResult && isCorrect ? "OK" : choice.label || String.fromCharCode(65 + index)}
                </span>
                <span className="text-base font-medium leading-relaxed text-gray-800">
                  {choice.text || "Choice unavailable."}
                </span>
              </button>
            );
          })}
        </div>

        {showExplanation && slide.explanation && (
          <div className="mt-5 rounded-2xl border border-gray-200 bg-gray-50 px-5 py-4">
            <span className="text-sm font-bold text-gray-800">Why: </span>
            <span className="text-sm font-medium text-gray-600">{slide.explanation}</span>
          </div>
        )}
      </div>

      <SlideVisualPanel
        imageUrl={resolveSlideImageUrl(slide)}
        alt={slide.visual_suggestion || slide.question}
        suggestion={slide.visual_suggestion}
        label="Question Context"
      />
    </div>
  );
}
