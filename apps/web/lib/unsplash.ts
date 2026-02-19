const BASE = "https://source.unsplash.com/featured/1200x700";

function simplify(query: string) {
  return query
    .toLowerCase()
    .replace(/diagram|labeled|labelled|with|of|showing|explain/g, "")
    .replace(/[^a-z0-9\s]/g, "")
    .trim()
    .split(" ")
    .slice(0, 3)          // 👈 LIMIT TO 3 WORDS
    .join(" ");
}

export function unsplashImageUrl(query?: string) {
  const q = simplify(query || "education classroom");
  return `${BASE}?${encodeURIComponent(q)}`;
}
