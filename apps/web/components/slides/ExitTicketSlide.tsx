"use client";

import React from "react";

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
    <div
      className="flex h-full w-full flex-col items-center justify-center overflow-hidden bg-white"
      style={{ borderTop: "4px solid #6C63FF" }}
    >
      <div
        className="flex w-full flex-col overflow-hidden"
        style={{ maxWidth: "600px", padding: "4% 5%" }}
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
          Exit Ticket
        </div>

        {/* Title */}
        <h2
          style={{
            fontSize: "clamp(20px, 3vw, 36px)",
            fontWeight: 800,
            color: "#0D0A1E",
            lineHeight: 1.1,
            letterSpacing: "-0.5px",
            margin: 0,
            marginBottom: "14px",
          }}
        >
          {slide.title}
        </h2>

        {/* Reflection prompt card */}
        <div
          style={{
            background: "#F3F0FF",
            border: "1.5px solid #DDD6FE",
            borderRadius: "12px",
            padding: "16px 20px",
            marginBottom: "12px",
          }}
        >
          <p
            style={{
              fontSize: "9px",
              fontWeight: 700,
              letterSpacing: "2.5px",
              color: "#7C3AED",
              textTransform: "uppercase" as const,
              marginBottom: "7px",
            }}
          >
            Reflection Prompt
          </p>
          <p
            style={{
              fontSize: "clamp(13px, 1.5vw, 17px)",
              fontWeight: 700,
              color: "#0D0A1E",
              lineHeight: 1.4,
            }}
          >
            {slide.prompt}
          </p>
        </div>

        {/* Response lines */}
        <div className="flex flex-col gap-2 overflow-hidden">
          {starters.slice(0, 3).map((starter, index) => (
            <div
              key={index}
              style={{
                background: "#FFFFFF",
                border: "1px solid #E5E7EB",
                borderRadius: "8px",
                padding: "11px 14px",
              }}
            >
              <p
                style={{
                  fontSize: "clamp(10px, 1.15vw, 13px)",
                  color: "#9CA3AF",
                  fontStyle: "italic",
                }}
              >
                {starter} _________________________
              </p>
            </div>
          ))}
        </div>

        {/* Confidence scale */}
        {slide.self_rating && (
          <div
            className="mt-3 flex items-center gap-2.5"
            style={{ flexWrap: "wrap" }}
          >
            <p
              style={{
                fontSize: "clamp(10px, 1.1vw, 12px)",
                fontWeight: 700,
                color: "#374151",
              }}
            >
              Confidence:
            </p>
            <div className="flex gap-1.5">
              {[1, 2, 3, 4, 5].map((num) => (
                <div
                  key={num}
                  className="flex items-center justify-center font-bold"
                  style={{
                    width: "28px",
                    height: "28px",
                    borderRadius: "50%",
                    border: "1.5px solid #6C63FF",
                    color: "#6C63FF",
                    fontSize: "11px",
                  }}
                >
                  {num}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
