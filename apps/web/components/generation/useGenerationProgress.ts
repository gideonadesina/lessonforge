"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export type ProgressStep = {
  title: string;
  description: string;
};

const GENERATION_STEPS: ProgressStep[] = [
  {
    title: "Generating lesson plan",
    description: "Drafting the lesson structure and objectives.",
  },
  {
    title: "Writing lesson notes",
    description: "Composing teacher-facing lesson notes.",
  },
  {
    title: "Creating quizzes",
    description: "Building assessment questions and answers.",
  },
  {
    title: "Preparing images",
    description: "Finding and preparing visuals for your slides.",
  },
  {
    title: "Creating slides",
    description: "Assembling slide titles and talking points.",
  },
  {
    title: "Finalizing lesson pack",
    description: "Putting everything together.",
  },
  {
    title: "Saving to library",
    description: "Saving your finished lesson pack to the library.",
  },
];

// Progress should move more slowly and stop before 100
const PROGRESS_TARGETS = [10, 25, 35, 58, 80, 90, 96];

const STEP_DELAYS = [40000, 55000, 35000, 75000, 75000, 35000, 0];

export function useGenerationProgress(isGenerating: boolean) {
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [progress, setProgress] = useState(0);
  const completedRef = useRef(false);
  const currentStepIndexRef = useRef(0);

  const updateProgress = useCallback((next: number) => {
    setProgress((previous) => {
      if (completedRef.current) return previous;
      return Math.max(previous, Math.min(100, next));
    });
  }, []);

  const setStepIndex = useCallback((index: number) => {
    currentStepIndexRef.current = index;
    setCurrentStepIndex(index);
  }, []);

  const completeProgress = useCallback(() => {
    completedRef.current = true;
    currentStepIndexRef.current = GENERATION_STEPS.length - 1;
    setCurrentStepIndex(GENERATION_STEPS.length - 1);
    setProgress(100);
  }, []);

  useEffect(() => {
    completedRef.current = false;

    if (!isGenerating) {
      setStepIndex(0);
      setProgress(0);
      return;
    }

    setStepIndex(0);
    setProgress(5);

    const timeouts: number[] = [];
    let elapsed = 0;

    PROGRESS_TARGETS.forEach((target, index) => {
      elapsed += STEP_DELAYS[index];
      timeouts.push(
        window.setTimeout(() => {
          if (completedRef.current) return;
          if (index === PROGRESS_TARGETS.length - 1) {
            setStepIndex(GENERATION_STEPS.length - 1);
          } else {
            setStepIndex(index + 1);
          }
          updateProgress(target);
        }, elapsed)
      );
    });

    const progressInterval = window.setInterval(() => {
      setProgress((previous) => {
        if (completedRef.current) return previous;

        if (currentStepIndexRef.current === GENERATION_STEPS.length - 1) {
          if (previous <= 94) return 94;
          return previous === 94 ? 96 : 94;
        }

        if (previous >= 95) return previous;
        const next = Math.min(95, previous + Math.floor(Math.random() * 6 + 3));
        return next;
      });
    }, 500);

    return () => {
      completedRef.current = false;
      timeouts.forEach(window.clearTimeout);
      window.clearInterval(progressInterval);
    };
  }, [isGenerating, updateProgress]);

  return {
    steps: GENERATION_STEPS,
    currentStepIndex,
    progress,
    completeProgress,
  };
}
