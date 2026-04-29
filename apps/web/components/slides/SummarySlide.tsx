"use client";

import React from "react";

type SummarySlideProps = {
  slide: {
    type: "summary";
    title: string;
    takeaways?: string[];
    connection_to_next?: string;
    visual_suggestion?: string;
    visual_type: "support";
    image_url?: string | null;
    image?: string | null;
  };
};

export default function SummarySlide({ slide }: SummarySlideProps) {
  const takeaways = Array.isArray(slide.takeaways) ? slide.takeaways : [];

  return (
    <div
      className="grid h-full w-full overflow-hidden bg-white"
      style={{ gridTemplateColumns: "65% 35%" }}
    >
      {/* Left: recap cards */}
      <div
        className="flex h-full flex-col justify-center overflow-hidden"
        style={{ padding: "5% 3% 5% 5%" }}
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
            marginBottom: "10px",
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
          Lesson Recap
        </div>

        <h2
          style={{
            fontSize: "clamp(18px, 2.8vw, 34px)",
            fontWeight: 800,
            color: "#0D0A1E",
            lineHeight: 1.1,
            letterSpacing: "-0.4px",
            margin: 0,
            marginBottom: "12px",
          }}
        >
          {slide.title}
        </h2>

        {/* Takeaway checkmark cards */}
        <div className="flex flex-col gap-2 overflow-hidden">
          {takeaways.slice(0, 5).map((takeaway, index) => (
            <div
              key={index}
              className="flex items-start gap-3"
              style={{
                background: "#F0FDF4",
                border: "1px solid #BBF7D0",
                borderRadius: "10px",
                padding: "9px 13px",
              }}
            >
              <span
                className="flex flex-shrink-0 items-center justify-center font-bold"
                style={{
                  width: "22px",
                  height: "22px",
                  borderRadius: "50%",
                  background: "#16A34A",
                  color: "#FFFFFF",
                  fontSize: "13px",
                  marginTop: "1px",
                }}
              >
                ✓
              </span>
              <span
                style={{
                  fontSize: "clamp(11px, 1.2vw, 13px)",
                  color: "#374151",
                  lineHeight: 1.5,
                  fontWeight: 500,
                }}
              >
                {takeaway}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Right: "Next Lesson" card */}
      <div
        className="flex h-full flex-col justify-center"
        style={{ padding: "5% 4% 5% 3%" }}
      >
        <div
          className="flex h-full max-h-[75%] flex-col justify-between rounded-2xl"
          style={{
            background: "linear-gradient(135deg, #6C63FF 0%, #4C46B6 100%)",
            borderRadius: "16px",
            padding: "22px 20px",
            boxShadow: "0 16px 48px -16px rgba(108,99,255,0.5)",
          }}
        >
          {/* LessonForge badge */}
          <div>
            <p
              style={{
                fontSize: "9px",
                fontWeight: 700,
                letterSpacing: "2.5px",
                color: "rgba(255,255,255,0.6)",
                textTransform: "uppercase" as const,
                marginBottom: "12px",
              }}
            >
              Coming Up
            </p>

            {slide.connection_to_next ? (
              <p
                style={{
                  fontSize: "clamp(12px, 1.4vw, 16px)",
                  fontWeight: 700,
                  color: "#FFFFFF",
                  lineHeight: 1.45,
                }}
              >
                {slide.connection_to_next}
              </p>
            ) : (
              <p
                style={{
                  fontSize: "clamp(12px, 1.4vw, 15px)",
                  fontWeight: 600,
                  color: "rgba(255,255,255,0.8)",
                  lineHeight: 1.45,
                }}
              >
                Great work today! Keep revising these key points.
              </p>
            )}
          </div>

          {/* Decorative bottom text */}
          <div
            style={{
              marginTop: "16px",
              paddingTop: "16px",
              borderTop: "1px solid rgba(255,255,255,0.15)",
            }}
          >
            <p
              style={{
                fontSize: "9px",
                fontWeight: 700,
                letterSpacing: "2px",
                color: "rgba(255,255,255,0.5)",
                textTransform: "uppercase" as const,
              }}
            >
              • LessonForge
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
