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
    <div
      className="grid h-full w-full bg-white overflow-hidden"
      style={{ gridTemplateColumns: "62% 38%" }}
    >
      {/* Left content */}
      <div
        className="flex h-full flex-col justify-center overflow-hidden"
        style={{ padding: "5% 4% 5% 5%" }}
      >
        {/* Category pill */}
        <div
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "7px",
            background: "#EDE9FE",
            border: "1px solid rgba(108,99,255,0.2)",
            borderRadius: "20px",
            padding: "4px 13px",
            marginBottom: "12px",
            fontSize: "10px",
            fontWeight: 700,
            letterSpacing: "3px",
            color: "#7C3AED",
            textTransform: "uppercase" as const,
            width: "fit-content",
          }}
        >
          <span
            style={{
              width: "6px",
              height: "6px",
              borderRadius: "50%",
              background: "#6C63FF",
              display: "inline-block",
            }}
          />
          Worked Example
        </div>

        {/* Title */}
        <h2
          style={{
            fontSize: "clamp(18px, 2.8vw, 34px)",
            fontWeight: 800,
            color: "#0D0A1E",
            lineHeight: 1.15,
            letterSpacing: "-0.4px",
            margin: 0,
            marginBottom: "12px",
          }}
        >
          {slide.title}
        </h2>

        {/* Steps */}
        <div className="flex flex-col gap-2 overflow-hidden">
          {steps.slice(0, 5).map((step, index) => (
            <div
              key={index}
              className="flex items-start gap-3"
              style={{
                background: "#FFFFFF",
                border: "1px solid rgba(108,99,255,0.15)",
                borderLeft: "3px solid #6C63FF",
                borderRadius: "10px",
                padding: "10px 14px",
              }}
            >
              {/* Step number */}
              <div
                className="flex flex-shrink-0 items-center justify-center font-bold text-white"
                style={{
                  width: "26px",
                  height: "26px",
                  borderRadius: "7px",
                  background: "#0D0A1E",
                  fontSize: "11px",
                  marginTop: "1px",
                }}
              >
                {step.step_num ?? index + 1}
              </div>

              <div className="min-w-0 flex-1">
                <p
                  style={{
                    fontSize: "clamp(11px, 1.2vw, 13.5px)",
                    color: "#374151",
                    lineHeight: 1.5,
                    fontWeight: 500,
                  }}
                >
                  {step.instruction || "Step unavailable."}
                </p>
                {step.tip && (
                  <div
                    className="mt-1.5"
                    style={{
                      background: "#FFFBEB",
                      borderRadius: "6px",
                      padding: "4px 8px",
                    }}
                  >
                    <p style={{ fontSize: "10px", fontWeight: 600, color: "#92400E" }}>
                      Tip: {step.tip}
                    </p>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Right image */}
      <SlideVisualPanel
        imageUrl={resolveSlideImageUrl(slide)}
        alt={slide.visual_suggestion || slide.title}
        suggestion={slide.visual_suggestion}
        label="Worked Visual"
      />
    </div>
  );
}
