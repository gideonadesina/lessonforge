"use client";

import React from "react";

type VocabularySlideProps = {
  slide: {
    type: "vocabulary";
    title: string;
    terms?: { word?: string; term?: string; name?: string; definition?: string; example?: string }[];
    visual_suggestion?: string;
    visual_type: "support";
    image_url?: string | null;
    image?: string | null;
  };
};

export default function VocabularySlide({ slide }: VocabularySlideProps) {
  const terms = Array.isArray(slide.terms) ? slide.terms : [];

  return (
    <div className="flex h-full w-full flex-col bg-white overflow-hidden">
      {/* Header */}
      <div style={{ padding: "5% 5% 2.5% 5%" }}>
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
          Key Vocabulary
        </div>
        <h2
          style={{
            fontSize: "clamp(20px, 3.2vw, 36px)",
            fontWeight: 800,
            color: "#0D0A1E",
            lineHeight: 1.1,
            letterSpacing: "-0.5px",
            margin: 0,
          }}
        >
          {slide.title}
        </h2>
      </div>

      {/* 2-column term card grid */}
      <div
        className="flex-1 overflow-hidden"
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: "12px",
          padding: "0 5% 4% 5%",
        }}
      >
        {terms.slice(0, 6).map((term, index) => {
          const word = term.word || term.term || term.name || "Term";
          return (
            <div
              key={index}
              style={{
                background: "#FFFFFF",
                border: "1px solid rgba(108,99,255,0.15)",
                borderLeft: "3px solid #6C63FF",
                borderRadius: "12px",
                padding: "14px 18px",
                boxShadow: "0 2px 12px rgba(108,99,255,0.06)",
                overflow: "hidden",
              }}
            >
              {/* Letter badge + term name */}
              <div className="flex items-center gap-2.5 mb-2">
                <span
                  className="flex flex-shrink-0 items-center justify-center font-bold text-white"
                  style={{
                    width: "26px",
                    height: "26px",
                    borderRadius: "6px",
                    background: "#6C63FF",
                    fontSize: "12px",
                  }}
                >
                  {String.fromCharCode(65 + index)}
                </span>
                <p
                  style={{
                    fontSize: "clamp(12px, 1.4vw, 15px)",
                    fontWeight: 700,
                    color: "#0D0A1E",
                    margin: 0,
                    lineHeight: 1.2,
                  }}
                >
                  {word}
                </p>
              </div>

              {/* Definition */}
              <p
                className="line-clamp-2"
                style={{
                  fontSize: "clamp(10px, 1.1vw, 12px)",
                  color: "#6B7280",
                  lineHeight: 1.5,
                  margin: 0,
                }}
              >
                {term.definition || "Definition unavailable."}
              </p>

              {/* Example */}
              {term.example && (
                <div
                  className="mt-2"
                  style={{
                    background: "#FFF7ED",
                    borderRadius: "6px",
                    padding: "4px 8px",
                  }}
                >
                  <p
                    className="line-clamp-1"
                    style={{
                      fontSize: "10px",
                      fontStyle: "italic",
                      color: "#92400E",
                    }}
                  >
                    e.g. {term.example}
                  </p>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
