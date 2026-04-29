"use client";

import React from "react";
import { resolveSlideImageUrl } from "@/lib/slideImageResolver";

type SlideVisualPanelProps = {
  imageUrl?: string | null;
  alt?: string;
  suggestion?: string;
  label?: string;
  className?: string;
};

export { resolveSlideImageUrl };

export default function SlideVisualPanel({
  imageUrl,
  alt,
  suggestion,
  label = "Visual Guide",
  className = "",
}: SlideVisualPanelProps) {
  return (
    <div className={`relative h-full w-full overflow-hidden ${className}`}>
      {imageUrl ? (
        <>
          <img
            src={imageUrl}
            alt={alt || suggestion || "Slide visual"}
            className="h-full w-full object-cover object-center"
            crossOrigin="anonymous"
          />
          {/* Bottom fade for caption readability */}
          <div
            className="absolute inset-0"
            style={{
              background:
                "linear-gradient(to bottom, transparent 45%, rgba(13,10,30,0.55) 100%)",
            }}
          />
          {/* Caption card */}
          {(label || suggestion) && (
            <div
              className="absolute bottom-4 left-4 right-4 rounded-xl px-3.5 py-3"
              style={{
                background: "rgba(255,255,255,0.9)",
                border: "1px solid rgba(108,99,255,0.12)",
                backdropFilter: "blur(14px)",
              }}
            >
              <p
                className="font-bold uppercase"
                style={{
                  fontSize: "8px",
                  letterSpacing: "2.5px",
                  color: "#6C63FF",
                }}
              >
                {label}
              </p>
              {suggestion && (
                <p className="mt-0.5 line-clamp-2 text-[11px] font-semibold leading-snug text-[#0D0A1E]">
                  {suggestion}
                </p>
              )}
            </div>
          )}
        </>
      ) : (
        /* Branded placeholder */
        <div
          className="flex h-full w-full items-center justify-center px-8 text-center"
          style={{
            background: "linear-gradient(135deg, #F3F0FF 0%, #EDE9FE 55%, #E9E4FF 100%)",
          }}
        >
          <div style={{ maxWidth: "240px" }}>
            <div
              className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl text-xl font-black text-white"
              style={{
                background: "linear-gradient(135deg, #6C63FF 0%, #4C46B6 100%)",
                boxShadow: "0 12px 36px -12px rgba(108,99,255,0.55)",
              }}
            >
              L
            </div>
            <p
              className="font-bold uppercase"
              style={{
                fontSize: "9px",
                letterSpacing: "2.5px",
                color: "#6C63FF",
              }}
            >
              {label}
            </p>
            {suggestion && (
              <p
                className="mt-2.5 font-semibold leading-snug text-[#0D0A1E]"
                style={{ fontSize: "13px" }}
              >
                {suggestion}
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
