/**
 * Safely resolves lesson content from various storage shapes.
 * Handles:
 * - result_json (primary JSONB field)
 * - legacy content field
 * - string-encoded JSON
 * - nested content inside result objects
 *
 * @param lesson - The lesson row with possible content fields
 * @returns Parsed lesson content object, or null if no valid content found
 */
export function resolveLessonContent(lesson: any): any {
  if (!lesson) return null;

  // Try primary field first: result_json
  const raw = lesson.result_json ?? lesson.content ?? null;
  if (!raw) return null;

  // If it's a string, attempt to parse as JSON
  if (typeof raw === "string") {
    try {
      return JSON.parse(raw);
    } catch {
      // If parsing fails, return null (not a valid JSON string)
      return null;
    }
  }

  // If it's already an object, return it directly
  if (typeof raw === "object") {
    return raw;
  }

  // Any other type: return null
  return null;
}

/**
 * Check if a lesson has valid, resolvable content.
 * @param lesson - The lesson row to check
 * @returns true if content can be resolved, false otherwise
 */
export function hasResolvedContent(lesson: any): boolean {
  return resolveLessonContent(lesson) !== null;
}
