"use client";

import React from "react";
import { resolveSlideImageUrl } from "./SlideVisualPanel";

type TitleSlideProps = {
  slide: {
    type: "title";
    title: string;
    subtitle?: string;
    hook_question?: string;
    visual_suggestion?: string;
    visual_type: "hero";
    image_url?: string | null;
    image?: string | null;
  };
};

export default function TitleSlide({ slide }: TitleSlideProps) {
  const imageUrl = resolveSlideImageUrl(slide);

  return (
    <div
      className="relative h-full w-full overflow-hidden"
      style={{ background: "#0D0A1E" }}
    >
      {/* Background image — right 45%, with fade-to-dark gradient on its left edge */}
      {imageUrl ? (
        <>
          <img
            src={imageUrl}
            alt={slide.visual_suggestion || slide.title}
            className="absolute top-0 right-0 h-full object-cover object-center"
            style={{ width: "48%" }}
            crossOrigin="anonymous"
          />
          {/* Gradient that blends image into dark bg */}
          <div
            className="absolute top-0 right-0 h-full pointer-events-none"
            style={{
              width: "60%",
              background:
                "linear-gradient(to right, #0D0A1E 0%, rgba(13,10,30,0.85) 28%, rgba(13,10,30,0.3) 62%, transparent 100%)",
            }}
          />
        </>
      ) : (
        /* No image — subtle purple radial glow */
        <div
          className="absolute inset-0"
          style={{
            background:
              "radial-gradient(ellipse at 75% 50%, rgba(108,99,255,0.18) 0%, transparent 65%)",
          }}
        />
      )}

      {/* Text content — left zone */}
      <div
        className="relative z-10 flex h-full items-center"
        style={{ paddingLeft: "6%", paddingRight: "46%", paddingTop: "7%", paddingBottom: "7%" }}
      >
        <div style={{ maxWidth: "100%" }}>
          {/* Category pill */}
          <div
            style={{
              display: "inline-block",
              background: "rgba(108,99,255,0.22)",
              border: "1px solid rgba(108,99,255,0.38)",
              borderRadius: "20px",
              padding: "4px 14px",
              marginBottom: "18px",
              fontSize: "10px",
              fontWeight: 700,
              letterSpacing: "3px",
              color: "#A78BFA",
              textTransform: "uppercase" as const,
            }}
          >
            Lesson Opener
          </div>

          {/* Title */}
          <h1
            style={{
              fontSize: "clamp(24px, 4.2vw, 50px)",
              fontWeight: 900,
              color: "#FFFFFF",
              lineHeight: 1.05,
              letterSpacing: "-1.5px",
              margin: 0,
            }}
          >
            {slide.title}
          </h1>

          {/* Subtitle */}
          {slide.subtitle && (
            <p
              style={{
                fontSize: "clamp(13px, 1.6vw, 18px)",
                color: "rgba(255,255,255,0.7)",
                marginTop: "14px",
                lineHeight: 1.5,
                fontWeight: 400,
                maxWidth: "360px",
              }}
            >
              {slide.subtitle}
            </p>
          )}

          {/* Hook question card */}
          {slide.hook_question && (
            <div
              style={{
                background: "rgba(255,255,255,0.08)",
                border: "1px solid rgba(255,255,255,0.14)",
                borderRadius: "12px",
                padding: "14px 18px",
                marginTop: "22px",
                maxWidth: "400px",
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
                Hook Question
              </p>
              <p
                style={{
                  fontSize: "clamp(12px, 1.3vw, 15px)",
                  color: "rgba(255,255,255,0.9)",
                  lineHeight: 1.5,
                  fontWeight: 500,
                }}
              >
                &ldquo;{slide.hook_question}&rdquo;
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
