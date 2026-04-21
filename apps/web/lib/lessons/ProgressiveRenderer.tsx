import { useEffect, useState } from "react";

/**
 * Progressive renderer for lesson sections.
 * Renders sections in priority order to show content as quickly as possible.
 * 
 * Priority:
 * 1. Meta + Lesson Plan (fast, small)
 * 2. Lesson Notes (medium)
 * 3. Quiz (medium)
 * 4. Slides (can be large with images)
 * 5. Live Applications (optional)
 */

type SectionName = "meta" | "lessonPlan" | "notes" | "quiz" | "slides" | "applications";

interface ProgressiveRendererProps {
  lessonContent: any;
  fallbackSubject: string;
  fallbackTopic: string;
  safeRender: (value: any) => React.ReactNode;
  LessonPreviewComponent: React.ComponentType<any>;
  onSectionReady?: (section: SectionName) => void;
}

export function useProgressiveRenderer(lessonContent: any, sectionRenderOrder?: SectionName[]) {
  const [renderedSections, setRenderedSections] = useState<Set<SectionName>>(new Set());

  const defaultOrder: SectionName[] = ["meta", "lessonPlan", "notes", "quiz", "slides", "applications"];
  const order = sectionRenderOrder || defaultOrder;

  useEffect(() => {
    if (!lessonContent) {
      setRenderedSections(new Set());
      return;
    }

    // Mark meta and lessonPlan as immediately available (synchronous)
    setRenderedSections(new Set(["meta", "lessonPlan"]));

    // Progressively render other sections with small delays to allow UI to update
    let timeoutIds: number[] = [];

    if (lessonContent.lessonNotes) {
      timeoutIds.push(
        window.setTimeout(() => {
          setRenderedSections((prev) => new Set([...prev, "notes"]));
        }, 100)
      );
    }

    if (lessonContent.quiz) {
      timeoutIds.push(
        window.setTimeout(() => {
          setRenderedSections((prev) => new Set([...prev, "quiz"]));
        }, 200)
      );
    }

    if (lessonContent.slides && lessonContent.slides.length > 0) {
      timeoutIds.push(
        window.setTimeout(() => {
          setRenderedSections((prev) => new Set([...prev, "slides"]));
        }, 300)
      );
    }

    if (lessonContent.liveApplications && lessonContent.liveApplications.length > 0) {
      timeoutIds.push(
        window.setTimeout(() => {
          setRenderedSections((prev) => new Set([...prev, "applications"]));
        }, 400)
      );
    }

    return () => {
      timeoutIds.forEach((id) => clearTimeout(id));
    };
  }, [lessonContent]);

  const isSectionReady = (section: string): boolean => {
    return renderedSections.has(section as SectionName);
  };

  return { isSectionReady, renderedSections };
}

/**
 * Skeleton for a single section with pulse animation.
 * Used while a section is loading or not yet ready.
 */
export function SectionSkeleton({
  lines = 3,
  title,
}: {
  lines?: number;
  title?: string;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 space-y-3">
      {title && (
        <div className="h-5 w-24 animate-pulse rounded bg-slate-300" />
      )}
      {Array.from({ length: lines }).map((_, i) => (
        <div
          key={i}
          className={`h-4 animate-pulse rounded bg-slate-300 ${
            i === lines - 1 ? "w-4/5" : "w-full"
          }`}
        />
      ))}
    </div>
  );
}

/**
 * Progressive content container that shows skeletons for not-yet-ready sections.
 */
export function ProgressiveContent({
  isReady,
  children,
  fallback = <SectionSkeleton lines={3} />,
}: {
  isReady: boolean;
  children: React.ReactNode;
  fallback?: React.ReactNode;
}) {
  if (!isReady) {
    return fallback;
  }

  return <>{children}</>;
}
