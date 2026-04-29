"use client";

import type { ReactNode } from "react";
import { useEffect, useState } from "react";

type PexelsImageProps = {
  query: string;
  className?: string;
  imgClassName?: string;
  children?: ReactNode;
  priority?: boolean;
};

const imageCache = new Map<string, string>();

export function PexelsImage({
  query,
  className = "",
  imgClassName = "",
  children,
}: PexelsImageProps) {
  const [src, setSrc] = useState(() => imageCache.get(query) ?? "");

  useEffect(() => {
    if (src || imageCache.has(query)) return;

    const key = process.env.NEXT_PUBLIC_PEXELS_API_KEY;
    if (!key) return;

    let cancelled = false;

    fetch(
      `https://api.pexels.com/v1/search?query=${encodeURIComponent(
        query
      )}&per_page=1&orientation=landscape`,
      { headers: { Authorization: key } }
    )
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error("Pexels failed"))))
      .then((data) => {
        const nextSrc = data?.photos?.[0]?.src?.large;
        if (typeof nextSrc === "string" && !cancelled) {
          imageCache.set(query, nextSrc);
          setSrc(nextSrc);
        }
      })
      .catch(() => undefined);

    return () => {
      cancelled = true;
    };
  }, [query, src]);

  return (
    <div
      className={[
        "relative overflow-hidden bg-gradient-to-br from-[#6C63FF] via-[#8B7CFF] to-[#A78BFA]",
        className,
      ].join(" ")}
    >
      {src && (
        <img
          src={src}
          alt=""
          className={["absolute inset-0 h-full w-full object-cover", imgClassName].join(" ")}
        />
      )}
      {children}
    </div>
  );
}
