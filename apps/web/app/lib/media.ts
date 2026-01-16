export function youtubeSearchUrl(q?: string) {
  const query = encodeURIComponent(q || "education lesson");
  return `https://www.youtube.com/results?search_query=${query}`;
}

export function unsplashImageUrl(q?: string) {
  // Free, no key needed. Always returns an image.
  const query = encodeURIComponent((q || "classroom education").replace(/,/g, " "));
  return `https://source.unsplash.com/800x450/?${query}`;
}

export function wikimediaSearchUrl(q?: string) {
  const query = encodeURIComponent(q || "education");
  return `https://commons.wikimedia.org/w/index.php?search=${query}&title=Special:MediaSearch&type=image`;
}
