"use client";

import React from "react";
import SlideVisualPanel, { resolveSlideImageUrl } from "./SlideVisualPanel";

type DiscussionSlideProps = {
  slide: {
    type: "discussion";
    prompt: string;
    guiding_questions?: string[];
    think_pair_share?: boolean;
    visual_suggestion?: string;
    visual_type: "support";
    image_url?: string | null;
    image?: string | null;
  };
};

export default function DiscussionSlide({ slide }: DiscussionSlideProps) {
  const questions = Array.isArray(slide.guiding_questions) ? slide.guiding_questions : [];

  return (
    <div
      className="grid h-full w-full overflow-hidden"
      style={{ gridTemplateColumns: "38% 62%", background: "#FFFFFF" }}
    >
      {/* Left image */}
      <SlideVisualPanel
        imageUrl={resolveSlideImageUrl(slide)}
        alt={slide.visual_suggestion || slide.prompt}
        suggestion={slide.visual_suggestion}
        label="Discussion Visual"
      />

      {/* Right content */}
      <div
        className="flex h-full flex-col justify-center overflow-hidden"
        style={{ padding: "5% 5% 5% 4%" }}
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
              }}
            />
            Discussion
          </div>
          {slide.think_pair_share && (
            <span
              style={{
                display: "inline-block",
                background: "#F3F0FF",
                border: "1px solid #DDD6FE",
                borderRadius: "20px",
                padding: "3px 11px",
                fontSize: "9px",
                fontWeight: 700,
                letterSpacing: "1.5px",
                color: "#6C63FF",
                textTransform: "uppercase" as const,
              }}
            >
              Think · Pair · Share
            </span>
          )}
        </div>

        {/* Prompt card — dark */}
        <div
          style={{
            background: "linear-gradient(135deg, #0D0A1E 0%, #1e1660 100%)",
            borderRadius: "14px",
            padding: "16px 20px",
            marginBottom: "14px",
          }}
        >
          <p
            style={{
              fontSize: "9px",
              fontWeight: 700,
              letterSpacing: "2.5px",
              color: "#A78BFA",
              textTransform: "uppercase" as const,
              marginBottom: "8px",
            }}
          >
            Prompt
          </p>
          <p
            style={{
              fontSize: "clamp(14px, 1.8vw, 20px)",
              fontWeight: 800,
              color: "#FFFFFF",
              lineHeight: 1.3,
              letterSpacing: "-0.3px",
            }}
          >
            &ldquo;{slide.prompt}&rdquo;
          </p>
        </div>

        {/* Guiding questions */}
        <div className="flex flex-col gap-2 overflow-hidden">
          {questions.length > 0 ? (
            questions.slice(0, 3).map((question, index) => (
              <div
                key={index}
                className="flex items-start gap-3"
                style={{
                  background: "#F9F8FF",
                  border: "1px solid #EDE9FE",
                  borderRadius: "10px",
                  padding: "9px 13px",
                }}
              >
                <span
                  className="flex flex-shrink-0 items-center justify-center font-bold text-[#6C63FF]"
                  style={{
                    width: "24px",
                    height: "24px",
                    borderRadius: "6px",
                    background: "#EDE9FE",
                    fontSize: "10px",
                    marginTop: "1px",
                  }}
                >
                  Q{index + 1}
                </span>
                <span
                  style={{
                    fontSize: "clamp(10px, 1.1vw, 12.5px)",
                    color: "#374151",
                    lineHeight: 1.5,
                    fontWeight: 500,
                  }}
                >
                  {question}
                </span>
              </div>
            ))
          ) : (
            <div
              style={{
                background: "#F9F8FF",
                border: "1px dashed #DDD6FE",
                borderRadius: "10px",
                padding: "12px 14px",
              }}
            >
              <p style={{ fontSize: "12px", color: "#6B7280", fontWeight: 500 }}>
                Use the prompt to surface evidence, examples, and opposing viewpoints.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
