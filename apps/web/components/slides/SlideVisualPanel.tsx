"use client";

import React from "react";

type SlideVisualPanelProps = {
  imageUrl?: string | null;
  alt?: string;
  suggestion?: string;
  label?: string;
  className?: string;
};

export function resolveSlideImageUrl(slide: {
  image_url?: string | null;
  image?: string | null;
}) {
  return slide.image_url || slide.image || null;
}

export default function SlideVisualPanel({
  imageUrl,
  alt,
  suggestion,
  label = "Visual Guide",
  className = "",
}: SlideVisualPanelProps) {
  return (
    <div className={`relative h-full w-full overflow-hidden bg-gray-950 ${className}`}>
      {imageUrl ? (
        <img
          src={imageUrl}
          alt={alt || suggestion || "Slide visual"}
          className="h-full w-full object-cover"
          crossOrigin="anonymous"
        />
      ) : (
        <div className="flex h-full w-full items-center justify-center bg-[radial-gradient(circle_at_18%_18%,#ffffff_0,#f6f2ff_34%,#e8eefc_68%,#eefdf5_100%)] px-10 text-center">
          <div className="max-w-sm">
            <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl border border-white/80 bg-white text-2xl font-black text-purple-700 shadow-[0_18px_45px_-28px_rgba(83,74,183,0.65)]">
              L
            </div>
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-purple-700">
              Visual Guide
            </p>
            {suggestion && (
              <p className="mt-3 text-lg font-semibold leading-snug text-gray-800">
                {suggestion}
              </p>
            )}
          </div>
        </div>
      )}

      <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-black/0 to-black/10" />

      {(label || suggestion) && (
        <div className="absolute bottom-6 left-6 right-6 rounded-2xl border border-white/35 bg-white/88 p-4 shadow-[0_18px_45px_-28px_rgba(17,17,39,0.55)] backdrop-blur-md">
          {label && (
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-gray-500">
              {label}
            </p>
          )}
          {suggestion && (
            <p className="mt-1 line-clamp-2 text-sm font-semibold leading-snug text-gray-900">
              {suggestion}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
