export function unsplashImageUrl(query: string) {
  const q = encodeURIComponent((query || "education classroom").trim());
  // Source endpoint returns a random photo matching query
  return `https://source.unsplash.com/featured/1200x700?${q}`;
}
