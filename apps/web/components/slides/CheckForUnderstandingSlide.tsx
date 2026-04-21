"use client";

import React, { useState } from "react";

type CheckForUnderstandingSlideProps = {
  slide: {
    type: "check_for_understanding";
    question: string;
    choices: { label: string; text: string; is_correct: boolean }[];
    explanation?: string;
    visual_suggestion: string;
    visual_type: "support";
  };
};

export default function CheckForUnderstandingSlide({ slide }: CheckForUnderstandingSlideProps) {
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [showExplanation, setShowExplanation] = useState(false);

  const handleSelect = (index: number) => {
    setSelectedIndex(index);
    setShowExplanation(true);
  };

  return (
    <div className="flex h-full w-full flex-col px-8 py-6">
      {/* Header */}
      <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-purple-200 bg-purple-50 px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.15em] text-purple-700">
        <span className="h-1.5 w-1.5 rounded-full bg-purple-500" />
        Check for Understanding
      </div>

      {/* Question */}
      <h2 className="text-2xl font-semibold leading-tight tracking-tight text-gray-900">
        {slide.question}
      </h2>

      {/* Choices */}
      <div className="mt-6 flex-1 space-y-3">
        {slide.choices.map((choice, index) => {
          const isSelected = selectedIndex === index;
          const isCorrect = choice.is_correct;
          const showResult = selectedIndex !== null;

          let borderClass = "border-gray-200 bg-white hover:border-purple-400 hover:bg-purple-50/40";
          let textClass = "text-gray-800";

          if (showResult) {
            if (isCorrect) {
              borderClass = "border-emerald-400 bg-emerald-50";
              textClass = "text-emerald-800";
            } else if (isSelected && !isCorrect) {
              borderClass = "border-red-400 bg-red-50";
              textClass = "text-red-800";
            }
          }

          return (
            <button
              key={index}
              type="button"
              onClick={() => !showResult && handleSelect(index)}
              disabled={showResult}
              className={`group flex w-full items-center gap-4 rounded-xl border-2 px-5 py-4 text-left transition ${borderClass}`}
            >
              <span
                className={`flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg text-sm font-semibold transition ${
                  showResult && isCorrect
                    ? "bg-emerald-500 text-white"
                    : showResult && isSelected && !isCorrect
                    ? "bg-red-500 text-white"
                    : "border-2 border-gray-200 bg-gray-50 text-gray-700 group-hover:border-purple-300 group-hover:bg-white group-hover:text-purple-700"
                }`}
              >
                {showResult && isCorrect ? "✓" : showResult && isSelected && !isCorrect ? "✗" : choice.label}
              </span>
              <span className={`text-base leading-relaxed ${textClass}`}>
                {choice.text}
              </span>
            </button>
          );
        })}
      </div>

      {/* Explanation */}
      {showExplanation && slide.explanation && (
        <div className="mt-4 flex-shrink-0 rounded-xl border border-gray-200 bg-gray-50 px-5 py-3">
          <span className="text-sm font-semibold text-gray-700">Why: </span>
          <span className="text-sm text-gray-600">{slide.explanation}</span>
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