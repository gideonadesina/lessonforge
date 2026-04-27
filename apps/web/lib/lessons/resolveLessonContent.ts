export function resolveLessonContent(lesson: any): any {
  if (!lesson) return null;

  const raw = lesson.result_json ?? lesson.content ?? null;
  if (!raw) return null;

  let parsed = raw;

  if (typeof raw === "string") {
    try {
      parsed = JSON.parse(raw);
    } catch {
      return null;
    }
  }

  if (!parsed || typeof parsed !== "object") return null;

  // Slides shape
  if (parsed.deck?.slides) return parsed.deck;
  if (parsed.data?.deck?.slides) return parsed.data.deck;

  // Lesson pack shape
  if (parsed.data?.lessonPlan || parsed.data?.lessonNotes) return parsed.data;

  return parsed;
}

export function hasResolvedContent(lesson: any): boolean {
  return resolveLessonContent(lesson) !== null;
}