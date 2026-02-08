"use client";

import { useEffect, useMemo, useState } from "react";

type Props = {
  query: string;
  alt?: string;
  className?: string;
};

function simplify(query: string) {
  return (query || "education classroom")
    .toLowerCase()
    .replace(/\b(diagram|labeled|labelled|with|of|showing|explain)\b/g, "")
    .replace(/[^a-z0-9\s]/g, "")
    .trim()
    .split(/\s+/)
    .slice(0, 3) // keep it short
    .join(" ");
}

export default function SlideImage({ query, alt = "Lesson image", className }: Props) {
  const [failed, setFailed] = useState(false);

  const src = useMemo(() => {
    const q = encodeURIComponent(simplify(query) || "education");
    // use "random" endpoint + sig to avoid caching
    return `https://source.unsplash.com/random/1200x700/?${q}&sig=${Date.now()}`;
  }, [query]);

  if (failed) {
    const fallback = `https://source.unsplash.com/random/1200x700/?education&sig=${Date.now()}`;
    return <img src={fallback} alt={alt} className={className} loading="lazy" />;
  }

  // ✅ src is never empty here
  return (
    <img
      src={src}
      alt={alt}
      className={className}
      loading="lazy"
      onError={() => setFailed(true)}
    />
  );
}
