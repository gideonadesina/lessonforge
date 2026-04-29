"use client";

import React from "react";
import SlideVisualPanel, { resolveSlideImageUrl } from "./SlideVisualPanel";

type ConceptSlideProps = {
  slide: {
    type: "concept" | "real_world_connection";
    title: string;
    explanation?: string;
    key_point?: string;
    analogy?: string;
    visual_suggestion?: string;
    visual_type: "diagram" | "support";
    image_url?: string | null;
    image?: string | null;
  };
};

export default function ConceptSlide({ slide }: ConceptSlideProps) {
  const imageUrl = resolveSlideImageUrl(slide);
  const categoryLabel =
    slide.type === "real_world_connection" ? "Real-world Connection" : "Core Concept";

  return (
    <div
      className="grid h-full w-full bg-white overflow-hidden"
      style={{ gridTemplateColumns: imageUrl ? "62% 38%" : "1fr" }}
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
              flexShrink: 0,
            }}
          />
          {categoryLabel}
        </div>

        {/* Title */}
        <h2
          style={{
            fontSize: "clamp(20px, 3.3vw, 40px)",
            fontWeight: 800,
            color: "#0D0A1E",
            lineHeight: 1.1,
            letterSpacing: "-0.5px",
            margin: 0,
          }}
        >
          {slide.title}
        </h2>

        {/* Explanation */}
        {slide.explanation && (
          <p
            style={{
              fontSize: "clamp(11px, 1.25vw, 14.5px)",
              color: "#374151",
              lineHeight: 1.7,
              marginTop: "10px",
              fontWeight: 400,
            }}
          >
            {slide.explanation}
          </p>
        )}

        {/* Cards row */}
        <div
          className="mt-4 flex flex-col gap-2.5 overflow-hidden"
          style={{ flex: imageUrl ? undefined : "0 0 auto" }}
        >
          {slide.key_point && (
            <div
              style={{
                background: "#FFFBEB",
                border: "1px solid #FDE68A",
                borderTop: "3px solid #F59E0B",
                borderRadius: "12px",
                padding: "12px 16px",
              }}
            >
              <p
                style={{
                  fontSize: "9px",
                  fontWeight: 700,
                  letterSpacing: "2px",
                  color: "#92400E",
                  textTransform: "uppercase" as const,
                  marginBottom: "5px",
                }}
              >
                {slide.type === "real_world_connection" ? "Key Connection" : "Key Point"}
              </p>
              <p
                style={{
                  fontSize: "clamp(11px, 1.2vw, 13.5px)",
                  fontWeight: 700,
                  color: "#0D0A1E",
                  lineHeight: 1.4,
                }}
              >
                {slide.key_point}
              </p>
            </div>
          )}

          {slide.analogy && (
            <div
              style={{
                background: "#F3F0FF",
                border: "1px solid #DDD6FE",
                borderTop: "3px solid #6C63FF",
                borderRadius: "12px",
                padding: "12px 16px",
              }}
            >
              <p
                style={{
                  fontSize: "9px",
                  fontWeight: 700,
                  letterSpacing: "2px",
                  color: "#6C63FF",
                  textTransform: "uppercase" as const,
                  marginBottom: "5px",
                }}
              >
                {slide.type === "real_world_connection" ? "Activity" : "Analogy"}
              </p>
              <p
                style={{
                  fontSize: "clamp(11px, 1.2vw, 13px)",
                  fontStyle: "italic",
                  color: "#374151",
                  lineHeight: 1.5,
                }}
              >
                {slide.analogy}
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Right image (only when image present) */}
      {imageUrl && (
        <SlideVisualPanel
          imageUrl={imageUrl}
          alt={slide.visual_suggestion || slide.title}
          suggestion={slide.visual_suggestion}
          label="Visual Guide"
        />
      )}
    </div>
  );
}
