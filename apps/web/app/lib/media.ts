export function youtubeSearchUrl(query: string) {
  return `https://www.youtube.com/results?search_query=${encodeURIComponent(query || "")}`;
}

export function wikimediaSearchUrl(query: string) {
  return `https://commons.wikimedia.org/wiki/Special:MediaSearch?type=image&search=${encodeURIComponent(
    query || ""
  )}`;
}
