const GENERIC_IMAGE_PATTERNS = [
  /photo-1524995997946-a1c2e315a42f/i,
  /\b(education|educational|books?|library|school|classroom|study|students-learning|teacher-teaching)\b/i,
];

export function isGenericFallbackImageUrl(value: unknown): boolean {
  if (typeof value !== "string") return false;
  const normalized = value.toLowerCase();
  let decoded = normalized;
  try {
    decoded = decodeURIComponent(normalized);
  } catch {}

  return GENERIC_IMAGE_PATTERNS.some((pattern) => pattern.test(decoded));
}

export function isValidPexelsImageUrl(value: unknown): value is string {
  if (typeof value !== "string" || !value.trim()) return false;

  try {
    const url = new URL(value);
    const hostname = url.hostname.toLowerCase();
    const isPexels = hostname === "images.pexels.com" || hostname.endsWith(".pexels.com");
    return isPexels && !isGenericFallbackImageUrl(value);
  } catch {
    return false;
  }
}

export function resolveSlideImageUrl(slide: {
  image_url?: string | null;
  image?: string | null;
}) {
  if (isValidPexelsImageUrl(slide.image_url)) return slide.image_url;
  if (isValidPexelsImageUrl(slide.image)) return slide.image;
  return null;
}
