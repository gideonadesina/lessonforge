/**
 * Honest generation stage system
 * Maps real generation stages to progress percentage ranges
 * 
 * Stages reflect actual backend work:
 * - queued: Request sent, waiting for processing
 * - planning: AI generating lesson structure/objectives  
 * - notes: AI writing detailed lesson notes
 * - assessments: AI creating quiz/test questions
 * - slides_images: Generating slide content + images
 * - saving: Persisting to database
 * - completed: All done
 * - failed: Generation failed
 */

export type GenerationStage = 
  | "queued"
  | "planning"
  | "notes"
  | "assessments"
  | "slides_images"
  | "saving"
  | "completed"
  | "failed";

export const STAGE_PROGRESS: Record<GenerationStage, { min: number; max: number }> = {
  queued: { min: 0, max: 5 },
  planning: { min: 5, max: 25 },
  notes: { min: 25, max: 45 },
  assessments: { min: 45, max: 65 },
  slides_images: { min: 65, max: 85 },
  saving: { min: 85, max: 98 },
  completed: { min: 100, max: 100 },
  failed: { min: 0, max: 0 }, // Doesn't advance progress
};

/**
 * Get the center point of a stage's progress range for smooth animation
 */
export function getStageProgress(stage: GenerationStage): number {
  const range = STAGE_PROGRESS[stage];
  if (range.min === range.max) return range.min; // For completed/failed
  return range.min + (range.max - range.min) * 0.7; // 70% through the range
}

/**
 * Interpolate progress smoothly within a stage's range
 * @param stage Current generation stage
 * @param elapsed Milliseconds elapsed in this stage
 * @param maxDuration Estimated total duration for this stage
 */
export function getInterpolatedProgress(
  stage: GenerationStage,
  elapsed: number,
  maxDuration: number
): number {
  if (stage === "completed") return 100;
  if (stage === "failed") return 0;

  const range = STAGE_PROGRESS[stage];
  const rangeSize = range.max - range.min;
  
  // Ease-in-out function for smooth animation
  let progress = elapsed / maxDuration;
  if (progress > 1) progress = 1;
  
  // Easing: start slow, accelerate, then slow down
  const eased = progress < 0.5 
    ? 2 * progress * progress 
    : -1 + (4 - 2 * progress) * progress;
  
  return range.min + rangeSize * Math.min(eased, 0.95);
}
