// Shared slide normalization — used across generate route, PDF, PPTX, and library rendering.
// No React dependencies so this is safe in both server and browser contexts.

export const CATEGORY_LABELS: Record<string, string> = {
  title: "Lesson Opener",
  learning_objectives: "Learning Objectives",
  concept: "Core Concept",
  vocabulary: "Key Vocabulary",
  worked_example: "Worked Example",
  check_for_understanding: "Check for Understanding",
  discussion: "Discussion",
  real_world_connection: "Real-world Connection",
  summary: "Lesson Recap",
  exit_ticket: "Exit Ticket",
};

function inferTitle(slide: Record<string, unknown>, topic?: string): string {
  const existing = typeof slide.title === "string" ? slide.title.trim() : "";
  const isPlaceholder = !existing || existing.toLowerCase() === "slide";

  if (!isPlaceholder) return existing;

  switch (slide.type) {
    case "title":
      return topic || "Lesson";
    case "learning_objectives":
      return "What You Will Learn Today";
    case "vocabulary":
      return "Key Terms";
    case "summary":
      return "What We Covered Today";
    case "exit_ticket":
      return "Before You Go";
    case "concept":
      return topic ? `Understanding ${topic}` : "Core Concept";
    case "real_world_connection":
      return "Where You See This in Real Life";
    case "worked_example":
      return topic ? `Working with ${topic}` : "Worked Example";
    case "check_for_understanding": {
      const q = typeof slide.question === "string" ? slide.question.trim() : "";
      return q || "Quick Check";
    }
    case "discussion": {
      const p = typeof slide.prompt === "string" ? slide.prompt.trim() : "";
      return p || "Let's Discuss";
    }
    default:
      return topic || "Lesson Content";
  }
}

export function normalizeSlide(
  slide: Record<string, unknown>,
  topic?: string
): Record<string, unknown> {
  const type = typeof slide.type === "string" ? slide.type : "concept";
  const normalized: Record<string, unknown> = { ...slide };

  normalized.type = type;
  normalized.title = inferTitle(slide, topic);
  normalized.categoryLabel = CATEGORY_LABELS[type] ?? "Lesson Content";

  // Image URL: prefer image_url, fall back to image, reject invalid values
  if (!isValidUrl(normalized.image_url)) {
    normalized.image_url = isValidUrl(slide.image) ? slide.image : null;
  }

  // Ensure visual_suggestion is set
  if (!normalized.visual_suggestion) {
    normalized.visual_suggestion =
      slide.imagePrompt ?? slide.visualPrompt ?? null;
  }

  // Map real_world_connection AI-generated field names → concept-layout field names.
  // The AI produces "scenario", "connection_points", "student_activity" but
  // the ConceptSlide component reads "explanation", "key_point", "analogy".
  if (type === "real_world_connection") {
    if (!normalized.explanation) {
      normalized.explanation = slide.scenario ?? null;
    }
    if (!normalized.key_point) {
      const pts = Array.isArray(slide.connection_points)
        ? (slide.connection_points as unknown[])
        : [];
      normalized.key_point = typeof pts[0] === "string" ? pts[0] : null;
    }
    if (!normalized.analogy) {
      normalized.analogy = slide.student_activity ?? null;
    }
  }

  // Ensure arrays exist for types that need them
  switch (type) {
    case "learning_objectives":
      if (!Array.isArray(normalized.objectives)) normalized.objectives = [];
      break;
    case "vocabulary":
      if (!Array.isArray(normalized.terms)) normalized.terms = [];
      break;
    case "check_for_understanding":
      if (!Array.isArray(normalized.choices)) normalized.choices = [];
      break;
    case "summary":
      if (!Array.isArray(normalized.takeaways)) normalized.takeaways = [];
      break;
    case "exit_ticket":
      if (!Array.isArray(normalized.sentence_starters))
        normalized.sentence_starters = [];
      break;
    case "worked_example":
      if (!Array.isArray(normalized.steps)) normalized.steps = [];
      break;
    case "discussion":
      if (!Array.isArray(normalized.guiding_questions))
        normalized.guiding_questions = [];
      break;
  }

  return normalized;
}

export function normalizeSlides(
  slides: unknown[],
  topic?: string
): Record<string, unknown>[] {
  if (!Array.isArray(slides)) return [];
  return slides
    .filter(
      (s) =>
        s !== null &&
        s !== undefined &&
        typeof s === "object" &&
        !Array.isArray(s)
    )
    .map((s) => normalizeSlide(s as Record<string, unknown>, topic));
}

function isValidUrl(value: unknown): value is string {
  if (typeof value !== "string" || !value.trim()) return false;
  try {
    new URL(value);
    return true;
  } catch {
    return false;
  }
}
