"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { GenerationStage, STAGE_PROGRESS, getInterpolatedProgress } from "./generationStages";

export type ProgressStep = {
  title: string;
  description: string;
};

const GENERATION_STEPS: ProgressStep[] = [
  {
    title: "Designing lesson structure",
    description: "Creating educational objectives and learning framework.",
  },
  {
    title: "Writing lesson notes",
    description: "Composing comprehensive teacher guidance and concepts.",
  },
  {
    title: "Creating assessments",
    description: "Building quiz questions and evaluation methods.",
  },
  {
    title: "Preparing visuals & slides",
    description: "Generating images and assembling presentation materials.",
  },
  {
    title: "Saving to library",
    description: "Securing your lesson pack to the library.",
  },
];

// Stage to step index mapping
const STAGE_TO_STEP_INDEX: Record<GenerationStage, number> = {
  queued: 0,
  planning: 0,
  notes: 1,
  assessments: 2,
  slides_images: 3,
  saving: 4,
  completed: 4,
  failed: 0,
};

export interface UseGenerationProgressProps {
  isGenerating: boolean;
  stage?: GenerationStage;
}

export function useGenerationProgress({ isGenerating, stage = "queued" }: UseGenerationProgressProps) {
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [progress, setProgress] = useState(0);
  const stageStartTimeRef = useRef<number>(Date.now());
  const completedRef = useRef(false);

  const completeProgress = useCallback(() => {
    completedRef.current = true;
    setCurrentStepIndex(GENERATION_STEPS.length - 1);
    setProgress(100);
  }, []);

  const failProgress = useCallback(() => {
    completedRef.current = true;
    setProgress(0);
  }, []);

  // Update progress when stage changes
  useEffect(() => {
    if (!isGenerating) {
      completedRef.current = false;
      setCurrentStepIndex(0);
      setProgress(0);
      return;
    }

    // Map stage to step index
    const stepIndex = STAGE_TO_STEP_INDEX[stage] ?? 0;
    setCurrentStepIndex(stepIndex);

    // Update progress based on stage
    if (stage === "completed") {
      completeProgress();
    } else if (stage === "failed") {
      failProgress();
    } else {
      // Calculate smooth progress within current stage
      const now = Date.now();
      const elapsed = now - stageStartTimeRef.current;
      
      // Estimated duration for each stage (in milliseconds)
      const stageDurations: Record<GenerationStage, number> = {
        queued: 500,
        planning: 5000,
        notes: 8000,
        assessments: 6000,
        slides_images: 8000,
        saving: 5000,
        completed: 0,
        failed: 0,
      };

      const duration = stageDurations[stage] ?? 5000;
      const interpolated = getInterpolatedProgress(stage, elapsed, duration);
      setProgress(interpolated);
    }
  }, [isGenerating, stage, completeProgress, failProgress]);

  // Smooth progress animation within current stage
  useEffect(() => {
    if (!isGenerating || stage === "completed" || stage === "failed" || stage === "saving") {
      return;
    }

    const animationInterval = setInterval(() => {
      if (completedRef.current) return;

      setProgress((previous) => {
        const range = STAGE_PROGRESS[stage];
        // Continue animating smoothly but don't jump too far
        if (previous >= range.max * 0.9) return previous;
        return previous + 0.5;
      });
    }, 200);

    return () => clearInterval(animationInterval);
  }, [isGenerating, stage]);

  // Reset stage start time when stage changes
  useEffect(() => {
    stageStartTimeRef.current = Date.now();
  }, [stage]);

  return {
    steps: GENERATION_STEPS,
    currentStepIndex,
    progress,
    completeProgress,
    failProgress,
  };
}
