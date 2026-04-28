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
    <div className="relative h-full w-full overflow-hidden">
      {imageUrl ? (
        <img
          src={imageUrl}
          alt={slide.visual_suggestion || slide.title}
          className="absolute inset-0 h-full w-full object-cover"
          crossOrigin="anonymous"
        />
      ) : (
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_18%_22%,#ffffff_0,#f5efff_34%,#eaf1ff_70%,#eefdf5_100%)]" />
      )}

      <div className="absolute inset-0 bg-gradient-to-r from-black/80 via-black/48 to-black/10" />

      <div className="relative z-10 flex h-full w-full items-center px-16 py-14">
        <div className="max-w-4xl">
          <div className="mb-5 inline-flex rounded-full border border-white/35 bg-white/15 px-4 py-2 text-xs font-bold uppercase tracking-[0.22em] text-white backdrop-blur">
            Lesson Opener
          </div>

          <h1 className="max-w-5xl text-7xl font-black leading-[0.88] tracking-tight text-white drop-shadow-lg">
            {slide.title}
          </h1>

          {slide.subtitle && (
            <p className="mt-6 max-w-3xl text-2xl font-semibold leading-snug text-white/90">
              {slide.subtitle}
            </p>
          )}

          {slide.hook_question && (
            <div className="mt-8 max-w-3xl rounded-3xl border border-white/30 bg-white/16 p-6 shadow-[0_24px_70px_-40px_rgba(0,0,0,0.8)] backdrop-blur-md">
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-purple-100">
                Hook Question
              </p>
              <p className="mt-2 text-2xl font-semibold leading-snug text-white">
                &quot;{slide.hook_question}&quot;
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
