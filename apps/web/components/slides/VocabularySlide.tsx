"use client";

import React from "react";

type VocabularySlideProps = {
  slide: {
    type: "vocabulary";
    title: string;
    terms: { word: string; definition: string; example?: string }[];
    visual_suggestion: string;
    visual_type: "support";
  };
};

export default function VocabularySlide({ slide }: VocabularySlideProps) {
  return (
    <div className="flex h-full w-full flex-col px-8 py-6">
      {/* Header */}
      <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-purple-200 bg-purple-50 px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.15em] text-purple-700">
        <span className="h-1.5 w-1.5 rounded-full bg-purple-500" />
        Key Vocabulary
      </div>

      <h2 className="text-3xl font-semibold tracking-tight text-gray-900">
        {slide.title}
      </h2>

      {/* Terms grid */}
      <div className="mt-6 flex-1 overflow-auto">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {slide.terms.map((term, index) => (
            <div
              key={index}
              className="group rounded-2xl border border-gray-200 bg-white p-5 shadow-sm transition hover:border-purple-400 hover:shadow-lg"
            >
              <div className="flex items-center gap-3">
                <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-purple-600/10 text-sm font-bold text-purple-700">
                  {String.fromCharCode(65 + index)}
                </span>
                <p className="text-lg font-semibold text-gray-900">
                  {term.word}
                </p>
              </div>
              <p className="mt-3 text-sm leading-relaxed text-gray-700">
                {term.definition}
              </p>
              {term.example && (
                <div className="mt-3 border-t border-gray-100 pt-3">
                  <p className="text-xs italic text-gray-500">
                    <span className="font-semibold">e.g.</span> {term.example}
                  </p>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Visual suggestion - support style */}
      <div className="flex-shrink-0 border-t border-gray-100 pt-4">
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