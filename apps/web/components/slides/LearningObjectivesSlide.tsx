"use client";

import React from "react";
import SlideVisualPanel, { resolveSlideImageUrl } from "./SlideVisualPanel";

type LearningObjectivesSlideProps = {
  slide: {
    type: "learning_objectives";
    title: string;
    objectives?: string[];
    bloom_level?: string;
    visual_suggestion?: string;
    visual_type: "support";
    image_url?: string | null;
    image?: string | null;
  };
};

export default function LearningObjectivesSlide({ slide }: LearningObjectivesSlideProps) {
  const objectives = Array.isArray(slide.objectives) ? slide.objectives : [];

  return (
    <div className="relative grid h-full w-full bg-white" style={{ gridTemplateColumns: "62% 38%" }}>
      {/* Purple left accent bar */}
      <div
        className="absolute left-0 top-0 bottom-0 z-10"
        style={{ width: "4px", background: "#6C63FF" }}
      />

      {/* Left content */}
      <div
        className="flex h-full flex-col justify-center overflow-hidden"
        style={{ padding: "5% 4% 5% 6%" }}
      >
        {/* Badge row */}
        <div className="mb-4 flex items-center gap-3 flex-wrap">
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "7px",
              background: "#EDE9FE",
              border: "1px solid rgba(108,99,255,0.2)",
              borderRadius: "20px",
              padding: "4px 13px",
              fontSize: "10px",
              fontWeight: 700,
              letterSpacing: "3px",
              color: "#7C3AED",
              textTransform: "uppercase" as const,
            }}
          >
            <span
              style={{
                width: "6px",
                height: "6px",
                borderRadius: "50%",
                background: "#6C63FF",
                display: "inline-block",
                flexShrink: 0,
              }}
            />
            Learning Objectives
          </div>
          {slide.bloom_level && (
            <span
              style={{
                display: "inline-block",
                background: "#FFF7ED",
                border: "1px solid #FDE68A",
                borderRadius: "20px",
                padding: "3px 11px",
                fontSize: "9px",
                fontWeight: 700,
                letterSpacing: "1.5px",
                color: "#92400E",
                textTransform: "uppercase" as const,
              }}
            >
              Bloom: {slide.bloom_level}
            </span>
          )}
        </div>

        {/* Title */}
        <h2
          style={{
            fontSize: "clamp(22px, 3.4vw, 40px)",
            fontWeight: 800,
            color: "#0D0A1E",
            lineHeight: 1.1,
            letterSpacing: "-0.5px",
            margin: 0,
          }}
        >
          {slide.title}
        </h2>

        <p
          style={{
            fontSize: "clamp(11px, 1.2vw, 13px)",
            color: "#6B7280",
            marginTop: "8px",
            fontWeight: 400,
          }}
        >
          By the end of this lesson, learners will be able to:
        </p>

        {/* Objectives */}
        <div className="mt-4 flex flex-col gap-2.5 overflow-hidden">
          {objectives.slice(0, 4).map((objective, index) => (
            <div
              key={index}
              className="flex items-start gap-3"
              style={{
                background: "#F9F8FF",
                border: "1px solid #EDE9FE",
                borderRadius: "10px",
                padding: "10px 14px",
              }}
            >
              <span
                className="flex flex-shrink-0 items-center justify-center font-bold text-white"
                style={{
                  width: "28px",
                  height: "28px",
                  borderRadius: "50%",
                  background: "#6C63FF",
                  fontSize: "12px",
                  lineHeight: 1,
                }}
              >
                {index + 1}
              </span>
              <span
                style={{
                  fontSize: "clamp(11px, 1.2vw, 13.5px)",
                  color: "#374151",
                  lineHeight: 1.55,
                  fontWeight: 500,
                  paddingTop: "4px",
                }}
              >
                {objective}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Right image */}
      <SlideVisualPanel
        imageUrl={resolveSlideImageUrl(slide)}
        alt={slide.visual_suggestion || slide.title}
        suggestion={slide.visual_suggestion}
        label="Learning Context"
      />
    </div>
  );
}
