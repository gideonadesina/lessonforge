"use client";

import React, { useState } from "react";

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
  const choices = Array.isArray(slide.choices) ? slide.choices : [];
  const revealed = selectedIndex !== null;

  return (
    <div
      className="flex h-full w-full flex-col items-center justify-center overflow-hidden"
      style={{ background: "#F9F8FF", padding: "4% 5%" }}
    >
      {/* Category pill — centered */}
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
        Check for Understanding
      </div>

      {/* Question */}
      <h2
        className="text-center"
        style={{
          fontSize: "clamp(16px, 2.4vw, 28px)",
          fontWeight: 800,
          color: "#0D0A1E",
          lineHeight: 1.25,
          letterSpacing: "-0.4px",
          maxWidth: "640px",
          marginBottom: "18px",
        }}
      >
        {slide.question}
      </h2>

      {/* 2×2 choices grid */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: choices.length <= 2 ? "1fr" : "1fr 1fr",
          gap: "10px",
          width: "100%",
          maxWidth: "700px",
        }}
      >
        {choices.slice(0, 4).map((choice, index) => {
          const isSelected = selectedIndex === index;
          const isCorrect = !!choice.is_correct;

          let bg = "#FFFFFF";
          let border = "1.5px solid #EDE9FE";
          let labelBg = "#6C63FF";
          let labelColor = "#FFFFFF";

          if (revealed) {
            if (isCorrect) {
              bg = "#F0FDF4";
              border = "1.5px solid #86EFAC";
              labelBg = "#16A34A";
            } else if (isSelected && !isCorrect) {
              bg = "#FFF1F2";
              border = "1.5px solid #FDA4AF";
              labelBg = "#DC2626";
            } else {
              labelBg = "#D1D5DB";
              labelColor = "#6B7280";
            }
          }

          return (
            <button
              key={index}
              type="button"
              onClick={() => !revealed && setSelectedIndex(index)}
              disabled={revealed}
              className="flex items-center gap-3 text-left transition-all"
              style={{
                background: bg,
                border,
                borderRadius: "10px",
                padding: "12px 16px",
                cursor: revealed ? "default" : "pointer",
                boxShadow: "0 2px 8px rgba(108,99,255,0.06)",
              }}
            >
              <span
                className="flex flex-shrink-0 items-center justify-center font-bold"
                style={{
                  width: "28px",
                  height: "28px",
                  borderRadius: "7px",
                  background: labelBg,
                  color: labelColor,
                  fontSize: "12px",
                  transition: "all 0.2s",
                }}
              >
                {choice.label || String.fromCharCode(65 + index)}
              </span>
              <span
                style={{
                  fontSize: "clamp(11px, 1.2vw, 13.5px)",
                  color: "#374151",
                  lineHeight: 1.45,
                  fontWeight: 500,
                }}
              >
                {choice.text || "Choice unavailable."}
              </span>
            </button>
          );
        })}
      </div>

      {/* Explanation (shows after selection) */}
      {revealed && slide.explanation && (
        <div
          className="mt-3"
          style={{
            maxWidth: "700px",
            width: "100%",
            background: "#F3F0FF",
            border: "1px solid #DDD6FE",
            borderRadius: "10px",
            padding: "10px 14px",
          }}
        >
          <span
            style={{
              fontSize: "clamp(10px, 1.1vw, 12px)",
              color: "#374151",
            }}
          >
            <span style={{ fontWeight: 700, color: "#6C63FF" }}>Why: </span>
            {slide.explanation}
          </span>
        </div>
      )}
    </div>
  );
}
