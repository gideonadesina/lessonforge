"use client";

import { useEffect, useMemo, useState, useCallback, memo } from "react";
import { pdf } from "@react-pdf/renderer";
import { createBrowserSupabase } from "@/lib/supabase/browser";
import { resolveLessonContent } from "@/lib/lessons/resolveLessonContent";
import { LessonSkeleton } from "@/lib/lessons/LessonSkeleton";
import { useLessonCache } from "@/lib/lessons/useLessonCache";
import { useProgressiveRenderer, SectionSkeleton, ProgressiveContent } from "@/lib/lessons/ProgressiveRenderer";
import SlideViewer from "@/components/slides/SlideViewer";
import { LessonPlanPdfDocument } from "@/components/lessons/LessonPlanPdfDocument";
import { track } from "@/lib/analytics";

// ─────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────

type LessonRow = {
  id: string;
  subject: string | null;
  topic: string | null;
  grade: string | null;
  curriculum: string | null;
  result_json: any | null;
  content?: any | null;
  created_at: string;
  type?: "lesson" | "slides" | null;
};

type SortMode = "newest" | "oldest";

// ─────────────────────────────────────────────────────────────
// CACHE KEY
// ─────────────────────────────────────────────────────────────

const CACHE_KEY = "lessonforge_library_cache";
const CACHE_TTL = 60_000; // 60 seconds

// ─────────────────────────────────────────────────────────────
// PURE UTILITIES — defined at file level, never recreated
// ─────────────────────────────────────────────────────────────

function youtubeSearchUrl(q: string) {
  return `https://www.youtube.com/results?search_query=${encodeURIComponent(q)}`;
}

function timeAgo(iso: string) {
  const diff = Math.max(0, Date.now() - new Date(iso).getTime());
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins} min${mins === 1 ? "" : "s"} ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs} hour${hrs === 1 ? "" : "s"} ago`;
  const days = Math.floor(hrs / 24);
  return `${days} day${days === 1 ? "" : "s"} ago`;
}

function downloadFile(filename: string, content: string, type = "text/plain;charset=utf-8") {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function downloadBlob(filename: string, blob: Blob) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function safeFilenamePart(value: unknown, fallback: string) {
  const cleaned = String(value ?? fallback)
    .replace(/[^\w\s-]/g, "")
    .trim()
    .replace(/\s+/g, "_");
  return cleaned || fallback;
}

function handleDownloadImage(src: string, title: string) {
  const a = document.createElement("a");
  a.href = src;
  a.download = `${title.replace(/[^\w\s-]/g, "").trim().replace(/\s+/g, "_") || "slide-image"}.png`;
  document.body.appendChild(a);
  a.click();
  a.remove();
}

function getLessonPayload(row: LessonRow | null) {
  if (!row) return null;

  const raw = row.result_json ?? row.content ?? null;
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

  return parsed?.deck ?? parsed?.data?.deck ?? parsed?.data ?? parsed;
}

// ─────────────────────────────────────────────────────────────
// safeRender — pure, file-level, never recreated on render
// ─────────────────────────────────────────────────────────────

function safeRender(value: any): React.ReactNode {
  if (value === null || value === undefined) return null;
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  if (Array.isArray(value)) {
    return (
      <ul className="list-disc pl-6 space-y-1">
        {value.map((item, i) => <li key={i}>{safeRender(item)}</li>)}
      </ul>
    );
  }
  if (typeof value === "object") {
    if ("question" in value || "markingGuide" in value) {
      return (
        <div className="space-y-2">
          {"question" in value && (
            <div className="text-sm text-[var(--text-primary)]">{safeRender(value.question)}</div>
          )}
          {"markingGuide" in value && (
            <div className="rounded-lg border border-[var(--border)] bg-[var(--card-alt)] p-3">
              <div className="text-xs font-semibold text-[var(--text-secondary)]">Marking Guide</div>
              <div className="mt-1 text-sm text-[var(--text-secondary)]">{safeRender(value.markingGuide)}</div>
            </div>
          )}
        </div>
      );
    }
    return (
      <div className="space-y-2">
        {Object.entries(value).map(([key, val]) => (
          <div key={key}>
            <div className="text-xs font-semibold text-[var(--text-secondary)] uppercase">{key}</div>
            <div className="text-sm text-[var(--text-primary)]">{safeRender(val)}</div>
          </div>
        ))}
      </div>
    );
  }
  return String(value);
}

// ─────────────────────────────────────────────────────────────
// buildLessonStructureText — pure, file-level
// ─────────────────────────────────────────────────────────────

function buildLessonStructureTextFromRow(row: LessonRow | null): string {
  const gen = resolveLessonContent(row);
  if (!gen || !row) return "";

  const meta = gen?.meta ?? {};
  const lessonPlan = gen?.lessonPlan ?? {};
  const slides = Array.isArray(gen?.slides) ? gen.slides : [];
  const mcq = Array.isArray(gen?.quiz?.mcq) ? gen.quiz.mcq : [];
  const theory = Array.isArray(gen?.quiz?.theory) ? gen.quiz.theory : [];
  const liveApps = Array.isArray(gen?.liveApplications) ? gen.liveApplications : [];

   const lines: string[] = [];
  lines.push("LESSONFORGE LESSON / CURRICULUM STRUCTURE REPORT");
  lines.push("=".repeat(55));
  lines.push("");
  lines.push(`Subject: ${meta?.subject ?? row.subject ?? ""}`);
  lines.push(`Topic: ${meta?.topic ?? row.topic ?? ""}`);
  lines.push(`Class: ${meta?.grade ?? row.grade ?? ""}`);
  lines.push(`Curriculum: ${meta?.curriculum ?? row.curriculum ?? ""}`);
  lines.push(`School Level: ${meta?.schoolLevel ?? ""}`);
  lines.push(`Number of Slides: ${meta?.numberOfSlides ?? slides.length ?? 0}`);
  lines.push(`Duration: ${meta?.durationMins ?? ""} minutes`);
  lines.push("");

  if (lessonPlan?.title) {
    lines.push("LESSON PLAN TITLE"); lines.push("-".repeat(20));
    lines.push(String(lessonPlan.title)); lines.push("");
  }
  if (Array.isArray(lessonPlan?.performanceObjectives) && lessonPlan.performanceObjectives.length) {
    lines.push("PERFORMANCE OBJECTIVES"); lines.push("-".repeat(24));
    lessonPlan.performanceObjectives.forEach((item: string, i: number) => lines.push(`${i + 1}. ${item}`));
    lines.push("");
  }
  if (Array.isArray(lessonPlan?.instructionalMaterials) && lessonPlan.instructionalMaterials.length) {
    lines.push("INSTRUCTIONAL MATERIALS"); lines.push("-".repeat(23));
    lessonPlan.instructionalMaterials.forEach((item: string, i: number) => lines.push(`${i + 1}. ${item}`));
    lines.push("");
  }
  if (lessonPlan?.previousKnowledge) {
    lines.push("PREVIOUS KNOWLEDGE"); lines.push("-".repeat(18));
    lines.push(String(lessonPlan.previousKnowledge)); lines.push("");
  }
  if (lessonPlan?.introduction) {
    lines.push("INTRODUCTION"); lines.push("-".repeat(12));
    lines.push(String(lessonPlan.introduction)); lines.push("");
  }
  if (Array.isArray(lessonPlan?.steps) && lessonPlan.steps.length) {
    lines.push("LESSON DELIVERY STEPS"); lines.push("-".repeat(21));
    lessonPlan.steps.forEach((step: any, i: number) => {
      lines.push(`Step ${step?.step ?? i + 1}: ${step?.title ?? "Lesson Step"}`);
      if (step?.teacherActivity) lines.push(`Teacher Activity: ${step.teacherActivity}`);
      if (step?.learnerActivity) lines.push(`Learner Activity: ${step.learnerActivity}`);
      if (step?.concretisedLearningPoint) lines.push(`Learning Point: ${step.concretisedLearningPoint}`);
      lines.push("");
    });
  }
  if (Array.isArray(lessonPlan?.evaluation) && lessonPlan.evaluation.length) {
    lines.push("EVALUATION"); lines.push("-".repeat(10));
    lessonPlan.evaluation.forEach((item: string, i: number) => lines.push(`${i + 1}. ${item}`));
    lines.push("");
  }
  if (Array.isArray(lessonPlan?.assignment) && lessonPlan.assignment.length) {
    lines.push("ASSIGNMENT"); lines.push("-".repeat(10));
    lessonPlan.assignment.forEach((item: string, i: number) => lines.push(`${i + 1}. ${item}`));
    lines.push("");
  }
  if (Array.isArray(lessonPlan?.realLifeConnection) && lessonPlan.realLifeConnection.length) {
    lines.push("REAL-LIFE CONNECTION"); lines.push("-".repeat(20));
    lessonPlan.realLifeConnection.forEach((item: string, i: number) => lines.push(`${i + 1}. ${item}`));
    lines.push("");
  }
  if (gen?.lessonNotes) {
    if (typeof gen.lessonNotes === "string") {
      lines.push("LESSON NOTES"); lines.push("-".repeat(12));
      lines.push(String(gen.lessonNotes)); lines.push("");
    } else {
      if (gen.lessonNotes.introduction) { lines.push("LESSON NOTES INTRODUCTION"); lines.push("-".repeat(25)); lines.push(gen.lessonNotes.introduction); lines.push(""); }
      if (gen.lessonNotes.keyConcepts?.length) {
        lines.push("KEY CONCEPTS"); lines.push("-".repeat(13));
        gen.lessonNotes.keyConcepts.forEach((c: any, i: number) => { lines.push(`${i + 1}. ${c.subheading || "Concept"}`); if (c.content) lines.push(`   ${c.content}`); lines.push(""); });
      }
      if (gen.lessonNotes.workedExamples?.length) {
        lines.push("WORKED EXAMPLES"); lines.push("-".repeat(15));
        gen.lessonNotes.workedExamples.forEach((ex: any, i: number) => {
          lines.push(`${i + 1}. ${ex.title || "Example"}`);
          if (ex.problem) lines.push(`   Problem: ${ex.problem}`);
          if (ex.steps?.length) { lines.push("   Steps:"); ex.steps.forEach((s: any, j: number) => lines.push(`     ${j + 1}. ${s}`)); }
          if (ex.finalAnswer) lines.push(`   Final Answer: ${ex.finalAnswer}`);
          lines.push("");
        });
      }
      if (gen.lessonNotes.summaryPoints?.length) {
        lines.push("SUMMARY POINTS"); lines.push("-".repeat(14));
        gen.lessonNotes.summaryPoints.forEach((p: any, i: number) => lines.push(`${i + 1}. ${p}`));
        lines.push("");
      }
      if (gen.lessonNotes.keyVocabulary?.length) {
        lines.push("KEY VOCABULARY"); lines.push("-".repeat(14));
        gen.lessonNotes.keyVocabulary.forEach((item: any, i: number) => lines.push(`${i + 1}. ${item.word || ""}: ${item.meaning || ""}`));
        lines.push("");
      }
    }
  }
  if (slides.length) {
    lines.push("SLIDE STRUCTURE"); lines.push("-".repeat(15));
    slides.forEach((slide: any, i: number) => {
      lines.push(`${i + 1}. ${slide?.title ?? `Slide ${i + 1}`}`);
      (Array.isArray(slide?.bullets) ? slide.bullets : []).forEach((b: string) => lines.push(`- ${b}`));
      if (slide?.interactivePrompt) lines.push(`Activity: ${slide.interactivePrompt}`);
      if (slide?.imageQuery) lines.push(`Image Focus: ${slide.imageQuery}`);
      if (slide?.videoQuery) lines.push(`Video Search: ${slide.videoQuery}`);
      lines.push("");
    });
  }
  if (mcq.length) {
    lines.push("MULTIPLE CHOICE QUESTIONS"); lines.push("-".repeat(25));
    mcq.forEach((item: any, i: number) => {
      lines.push(`${i + 1}. ${item?.q ?? "Question"}`);
      (Array.isArray(item?.options) ? item.options : []).forEach((opt: string, j: number) => lines.push(`   ${String.fromCharCode(65 + j)}. ${opt}`));
      if (typeof item?.answerIndex === "number") lines.push(`   Answer: ${String.fromCharCode(65 + item.answerIndex)}`);
      lines.push("");
    });
  }
  if (theory.length) {
    lines.push("THEORY QUESTIONS"); lines.push("-".repeat(16));
    theory.forEach((item: any, i: number) => {
      lines.push(`${i + 1}. ${item?.q ?? "Question"}`);
      if (item?.markingGuide) lines.push(`Marking Guide: ${item.markingGuide}`);
      lines.push("");
    });
  }
  if (liveApps.length) {
    lines.push("LIVE / REAL-WORLD APPLICATIONS"); lines.push("-".repeat(30));
    liveApps.forEach((item: string, i: number) => lines.push(`${i + 1}. ${item}`));
    lines.push("");
  }
  lines.push("Generated with LessonForge");
  return lines.join("\n");
}

function handleDownloadLessonStructureFromRow(row: LessonRow | null) {
  if (!row) return;

  const raw = row.result_json ?? row.content ?? null;
  if (!raw) return;

  // Detect slide deck vs lesson pack
  const isSlides = row.type === "slides" || raw?.slides?.length > 0 && raw?.deck_title;

  if (isSlides) {
    handleDownloadSlideDeck(row, raw);
    return;
  }

  // Original lesson pack download
  const gen = resolveLessonContent(row);
  const meta = gen?.meta ?? {};
  const safeSubject = String(meta?.subject ?? row.subject ?? "subject")
    .replace(/[^\w\s-]/g, "").trim().replace(/\s+/g, "_");
  const safeTopic = String(meta?.topic ?? row.topic ?? "topic")
    .replace(/[^\w\s-]/g, "").trim().replace(/\s+/g, "_");
  downloadFile(
    `LessonForge_${safeSubject}_${safeTopic}_Structure.txt`,
    buildLessonStructureTextFromRow(row)
  );
}

function handleDownloadSlideDeck(row: LessonRow, raw: any) {
  const deck = raw?.deck ?? raw;
  const slides = deck?.slides ?? [];
  const title = deck?.deck_title ?? row.topic ?? "slides";

  const lines: string[] = [];
  lines.push("LESSONFORGE SLIDE DECK");
  lines.push("=".repeat(50));
  lines.push(`Title: ${title}`);
  lines.push(`Subject: ${deck?.subject ?? row.subject ?? ""}`);
  lines.push(`Grade: ${deck?.grade ?? row.grade ?? ""}`);
  lines.push(`Bloom Level: ${deck?.bloom_level ?? ""}`);
  lines.push(`Total Slides: ${slides.length}`);
  lines.push("");

  slides.forEach((slide: any, i: number) => {
    lines.push(`SLIDE ${i + 1} — ${(slide.type ?? "").toUpperCase()}`);
    lines.push("-".repeat(30));

    if (slide.title) lines.push(`Title: ${slide.title}`);
    if (slide.subtitle) lines.push(`Subtitle: ${slide.subtitle}`);
    if (slide.hook_question) lines.push(`Hook: ${slide.hook_question}`);
    if (slide.explanation) lines.push(`Explanation: ${slide.explanation}`);
    if (slide.key_point) lines.push(`Key Point: ${slide.key_point}`);
    if (slide.analogy) lines.push(`Analogy: ${slide.analogy}`);
    if (slide.prompt) lines.push(`Prompt: ${slide.prompt}`);
    if (slide.question) lines.push(`Question: ${slide.question}`);
    if (slide.teacher_notes) lines.push(`Teacher Notes: ${slide.teacher_notes}`);
    if (slide.time_minutes) lines.push(`Time: ${slide.time_minutes} mins`);

    if (Array.isArray(slide.objectives)) {
      lines.push("Objectives:");
      slide.objectives.forEach((o: string) => lines.push(`  - ${o}`));
    }

    if (Array.isArray(slide.terms)) {
      lines.push("Vocabulary Terms:");
      slide.terms.forEach((t: any) => {
        lines.push(`  ${t.word ?? t.term ?? ""}: ${t.definition ?? ""}`);
        if (t.example) lines.push(`    e.g. ${t.example}`);
      });
    }

    if (Array.isArray(slide.steps)) {
      lines.push("Steps:");
      slide.steps.forEach((s: any) => {
        lines.push(`  Step ${s.step_num}: ${s.instruction}`);
        if (s.tip) lines.push(`    Tip: ${s.tip}`);
      });
    }

    if (Array.isArray(slide.choices)) {
      lines.push("Choices:");
      slide.choices.forEach((c: any) => {
        lines.push(`  ${c.label}. ${c.text}${c.is_correct ? " ✓" : ""}`);
      });
      if (slide.explanation) lines.push(`  Explanation: ${slide.explanation}`);
    }

    if (Array.isArray(slide.takeaways)) {
      lines.push("Takeaways:");
      slide.takeaways.forEach((t: string) => lines.push(`  - ${t}`));
    }

    if (Array.isArray(slide.sentence_starters)) {
      lines.push("Sentence Starters:");
      slide.sentence_starters.forEach((s: string) => lines.push(`  ${s}`));
    }

    if (slide.differentiation) {
      lines.push("Differentiation:");
      if (slide.differentiation.support) lines.push(`  Support: ${slide.differentiation.support}`);
      if (slide.differentiation.extension) lines.push(`  Extension: ${slide.differentiation.extension}`);
    }

    lines.push("");
  });

  lines.push("Generated with LessonForge");

  const safeTitle = title.replace(/[^\w\s-]/g, "").trim().replace(/\s+/g, "_");
  downloadFile(`LessonForge_${safeTitle}_slides.txt`, lines.join("\n"));
}

// ─────────────────────────────────────────────────────────────
// LessonPreview — file-level + React.memo
// Moved OUTSIDE LibraryPage so React never treats it as a new
// component type on re-render, preventing full unmount/remount.
// ─────────────────────────────────────────────────────────────

const LessonPreview = memo(function LessonPreview({
  gen,
  fallbackSubject,
  fallbackTopic,
  isSectionReady = () => true,
  onPreviewImage,
  onDownloadImage,
}: {
  gen: any;
  fallbackSubject: string;
  fallbackTopic: string;
  isReady?: boolean;
  isSectionReady?: (section: string) => boolean;
  onPreviewImage: (img: { src: string; title: string }) => void;
  onDownloadImage: (src: string, title: string) => void;
}) {
  const meta = gen?.meta ?? {};
  const subject = meta?.subject ?? fallbackSubject;
  const topic = meta?.topic ?? fallbackTopic;
  const slides: any[] = Array.isArray(gen?.slides) ? gen.slides : [];
  const mcq: any[] = Array.isArray(gen?.quiz?.mcq) ? gen.quiz.mcq : [];
  const theory: any[] = Array.isArray(gen?.quiz?.theory) ? gen.quiz.theory : [];
  const lessonPlan = gen?.lessonPlan ?? null;
  const liveApps: string[] = Array.isArray(gen?.liveApplications) ? gen.liveApplications : [];

  return (
    <div className="space-y-6">
      {/* Meta header */}
      <div className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-4">
        <div className="text-xs text-[var(--text-tertiary)]">Lesson Pack</div>
        <div className="mt-1 text-xl font-extrabold text-[var(--text-primary)]">{topic || "Lesson"}</div>
        <div className="mt-1 text-sm text-[var(--text-secondary)]">
          {subject && <span className="font-semibold text-[var(--text-primary)]">{subject}</span>}
          {meta?.grade && <span> • {meta.grade}</span>}
          {meta?.curriculum && <span> • {meta.curriculum}</span>}
          {meta?.durationMins && <span> • {meta.durationMins} mins</span>}
        </div>
      </div>

      {/* Lesson Plan */}
      <ProgressiveContent isReady={isSectionReady("lessonPlan")} fallback={<SectionSkeleton title="Lesson Plan" />}>
        {lessonPlan ? (
          <section className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-4 space-y-5">
            <h3 className="text-sm font-bold text-[var(--text-primary)]">Lesson Plan</h3>
            {lessonPlan?.title && (
              <div>
                <div className="text-xs font-semibold uppercase tracking-wide text-[var(--text-tertiary)]">Title</div>
                <div className="mt-1 text-sm text-[var(--text-primary)]">{safeRender(lessonPlan.title)}</div>
              </div>
            )}
            {Array.isArray(lessonPlan?.performanceObjectives) && lessonPlan.performanceObjectives.length > 0 && (
              <div>
                <div className="text-xs font-semibold uppercase tracking-wide text-[var(--text-tertiary)]">Performance Objectives</div>
                <ul className="mt-2 list-disc pl-6 space-y-1 text-sm text-[var(--text-primary)]">
                  {lessonPlan.performanceObjectives.map((item: any, i: number) => <li key={i}>{safeRender(item)}</li>)}
                </ul>
              </div>
            )}
            {Array.isArray(lessonPlan?.instructionalMaterials) && lessonPlan.instructionalMaterials.length > 0 && (
              <div>
                <div className="text-xs font-semibold uppercase tracking-wide text-[var(--text-tertiary)]">Instructional Materials</div>
                <ul className="mt-2 list-disc pl-6 space-y-1 text-sm text-[var(--text-primary)]">
                  {lessonPlan.instructionalMaterials.map((item: any, i: number) => <li key={i}>{safeRender(item)}</li>)}
                </ul>
              </div>
            )}
            {lessonPlan?.previousKnowledge && (
              <div>
                <div className="text-xs font-semibold uppercase tracking-wide text-[var(--text-tertiary)]">Previous Knowledge</div>
                <div className="mt-1 whitespace-pre-wrap text-sm text-[var(--text-primary)]">{safeRender(lessonPlan.previousKnowledge)}</div>
              </div>
            )}
            {lessonPlan?.introduction && (
              <div>
                <div className="text-xs font-semibold uppercase tracking-wide text-[var(--text-tertiary)]">Introduction</div>
                <div className="mt-1 whitespace-pre-wrap text-sm text-[var(--text-primary)]">{safeRender(lessonPlan.introduction)}</div>
              </div>
            )}
            {Array.isArray(lessonPlan?.steps) && lessonPlan.steps.length > 0 && (
              <div className="space-y-3">
                <div className="text-xs font-semibold uppercase tracking-wide text-[var(--text-tertiary)]">Lesson Delivery Steps</div>
                {lessonPlan.steps.map((step: any, i: number) => (
                  <div key={i} className="rounded-xl border border-[var(--border)] bg-[var(--card-alt)] p-4 space-y-2">
                    <div className="font-semibold text-[var(--text-primary)]">Step {step?.step ?? i + 1}: {safeRender(step?.title || "Lesson Step")}</div>
                    {step?.teacherActivity && <div className="text-sm text-[var(--text-primary)]"><span className="font-semibold">Teacher Activity:</span> {safeRender(step.teacherActivity)}</div>}
                    {step?.learnerActivity && <div className="text-sm text-[var(--text-primary)]"><span className="font-semibold">Learner Activity:</span> {safeRender(step.learnerActivity)}</div>}
                    {step?.concretisedLearningPoint && <div className="text-sm text-[var(--text-primary)]"><span className="font-semibold">Learning Point:</span> {safeRender(step.concretisedLearningPoint)}</div>}
                  </div>
                ))}
              </div>
            )}
            {Array.isArray(lessonPlan?.evaluation) && lessonPlan.evaluation.length > 0 && (
              <div>
                <div className="text-xs font-semibold uppercase tracking-wide text-[var(--text-tertiary)]">Evaluation</div>
                <div className="mt-2 space-y-2">
                  {lessonPlan.evaluation.map((item: any, i: number) => (
                    <div key={i} className="rounded border border-[var(--border)] p-2">
                      {typeof item === "object" && item?.question ? (
                        <>
                          <p className="text-sm font-medium text-[var(--text-primary)]">{item.question}</p>
                          {item.questionType && <p className="text-xs text-[var(--text-secondary)] uppercase">Type: {item.questionType}</p>}
                          {item.markingGuide && <p className="mt-1 text-sm text-[var(--text-secondary)]"><span className="font-medium">Guide:</span> {item.markingGuide}</p>}
                        </>
                      ) : (
                        <p className="text-sm text-[var(--text-primary)]">{safeRender(item)}</p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
            {Array.isArray(lessonPlan?.assignment) && lessonPlan.assignment.length > 0 && (
              <div>
                <div className="text-xs font-semibold uppercase tracking-wide text-[var(--text-tertiary)]">Assignment</div>
                <ul className="mt-2 list-disc pl-6 space-y-1 text-sm text-[var(--text-primary)]">
                  {lessonPlan.assignment.map((item: any, i: number) => <li key={i}>{safeRender(item)}</li>)}
                </ul>
              </div>
            )}
            {Array.isArray(lessonPlan?.realLifeConnection) && lessonPlan.realLifeConnection.length > 0 && (
              <div>
                <div className="text-xs font-semibold uppercase tracking-wide text-[var(--text-tertiary)]">Real-life Connection</div>
                <ul className="mt-2 list-disc pl-6 space-y-1 text-sm text-[var(--text-primary)]">
                  {lessonPlan.realLifeConnection.map((item: any, i: number) => <li key={i}>{safeRender(item)}</li>)}
                </ul>
              </div>
            )}
          </section>
        ) : null}
      </ProgressiveContent>

      {/* Lesson Notes */}
      <ProgressiveContent isReady={isSectionReady("notes")} fallback={<SectionSkeleton title="Lesson Notes" />}>
        {gen?.lessonNotes ? (
          <section className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-4">
            <h3 className="text-sm font-bold text-[var(--text-primary)]">Lesson Notes</h3>
            <div className="mt-2">
              {typeof gen.lessonNotes === "string" ? (
                <div className="whitespace-pre-wrap text-sm text-[var(--text-primary)] leading-relaxed">{safeRender(gen.lessonNotes)}</div>
              ) : (
                <div className="space-y-3">
                  {gen.lessonNotes.introduction && (
                    <div>
                      <p className="text-xs font-semibold text-[var(--text-secondary)] uppercase">Introduction</p>
                      <p className="mt-1 text-sm text-[var(--text-primary)] leading-relaxed">{gen.lessonNotes.introduction}</p>
                    </div>
                  )}
                  {gen.lessonNotes.keyConcepts?.length > 0 && (
                    <div>
                      <p className="text-xs font-semibold text-[var(--text-secondary)] uppercase">Key Concepts</p>
                      <div className="mt-2 space-y-2">
                        {gen.lessonNotes.keyConcepts.map((concept: any, i: number) => (
                          <div key={i} className="border-l-2 border-violet-200 pl-2">
                            <p className="text-sm font-medium text-[var(--text-primary)]">{concept.subheading || `Concept ${i + 1}`}</p>
                            {concept.content && <p className="mt-1 text-sm text-[var(--text-secondary)]">{concept.content}</p>}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  {gen.lessonNotes.workedExamples?.length > 0 && (
                    <div>
                      <p className="text-xs font-semibold text-[var(--text-secondary)] uppercase">Worked Examples</p>
                      <div className="mt-2 space-y-3">
                        {gen.lessonNotes.workedExamples.map((example: any, i: number) => (
                          <div key={i} className="rounded border border-[var(--border)] p-2">
                            <p className="text-sm font-medium text-[var(--text-primary)]">{example.title || `Example ${i + 1}`}</p>
                            {example.problem && <p className="mt-1 text-sm text-[var(--text-secondary)]"><span className="font-medium">Problem:</span> {example.problem}</p>}
                            {example.steps?.length > 0 && (
                              <ol className="mt-1 list-decimal pl-5 text-sm text-[var(--text-secondary)]">
                                {example.steps.map((step: any, j: number) => <li key={j}>{step}</li>)}
                              </ol>
                            )}
                            {example.finalAnswer && <p className="mt-1 text-sm text-[var(--text-secondary)]"><span className="font-medium">Answer:</span> {example.finalAnswer}</p>}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  {gen.lessonNotes.summaryPoints?.length > 0 && (
                    <div>
                      <p className="text-xs font-semibold text-[var(--text-secondary)] uppercase">Summary Points</p>
                      <ul className="mt-2 list-disc pl-5 text-sm text-[var(--text-primary)]">
                        {gen.lessonNotes.summaryPoints.map((point: any, i: number) => <li key={i}>{point}</li>)}
                      </ul>
                    </div>
                  )}
                  {gen.lessonNotes.keyVocabulary?.length > 0 && (
                    <div>
                      <p className="text-xs font-semibold text-[var(--text-secondary)] uppercase">Key Vocabulary</p>
                      <div className="mt-2 space-y-1">
                        {gen.lessonNotes.keyVocabulary.map((item: any, i: number) => (
                          <div key={i} className="flex gap-2 text-sm">
                            <span className="font-medium text-[var(--text-primary)]">{item.word}</span>
                            <span className="text-[var(--text-secondary)]">:</span>
                            <span className="text-[var(--text-secondary)]">{item.meaning}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </section>
        ) : null}
      </ProgressiveContent>

      {/* Slides */}
      <ProgressiveContent isReady={isSectionReady("slides")} fallback={<SectionSkeleton title="Slides" lines={4} />}>
        {slides.length > 0 ? (
          <section className="space-y-4">
            <h3 className="text-sm font-bold text-[var(--text-primary)]">Slides</h3>
            <div className="grid gap-6">
              {slides.map((s, i) => {
                const title = s?.title || `Slide ${i + 1}`;
                const bullets: string[] = Array.isArray(s?.bullets) ? s.bullets : [];
                const videoQuery = s?.videoQuery || title || `${subject} ${topic}`;
                const activity = s?.interactivePrompt || "No interactive activity provided.";
                const img = s?.image || "https://images.unsplash.com/photo-1524995997946-a1c2e315a42f?w=1200";

                return (
                  <div key={i} className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-5 shadow-sm space-y-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="text-lg font-bold text-[var(--text-primary)]">{i + 1}. {title}</div>
                      <span className="text-[11px] font-semibold px-2 py-1 rounded-full border bg-[var(--card-alt)] text-[var(--text-secondary)]">Slide {i + 1}</span>
                    </div>
                    <div className="rounded-xl overflow-hidden border bg-slate-100">
                      <button type="button" onClick={() => onPreviewImage({ src: img, title })} className="block w-full text-left">
                        <img src={img} alt={title} className="w-full h-48 object-cover transition hover:scale-[1.01]"
                          onError={(e) => { e.currentTarget.src = "https://images.unsplash.com/photo-1524995997946-a1c2e315a42f?w=1200"; }} />
                      </button>
                    </div>
                    <div className="flex flex-wrap gap-3 text-sm">
                      <button type="button" onClick={() => onPreviewImage({ src: img, title })}
                        className="rounded-lg border border-[var(--border)] bg-[var(--card)] px-3 py-2 font-semibold text-[var(--text-primary)] hover:bg-slate-100">
                        View full image
                      </button>
                      <button type="button" onClick={() => onDownloadImage(img, title)}
                        className="rounded-lg border border-[var(--border)] bg-[var(--card)] px-3 py-2 font-semibold text-[var(--text-primary)] hover:bg-slate-100">
                        Download image
                      </button>
                    </div>
                    {bullets.length > 0 ? (
                      <ul className="list-disc pl-6 space-y-2 text-[var(--text-primary)] font-medium">
                        {bullets.map((b, j) => <li key={j}>{safeRender(b)}</li>)}
                      </ul>
                    ) : (
                      <p className="text-sm text-[var(--text-secondary)]">No bullet points.</p>
                    )}
                    <div className="flex flex-wrap gap-4 text-sm">
                      <a href={youtubeSearchUrl(videoQuery)} target="_blank" rel="noreferrer" className="text-blue-600 font-semibold hover:underline">🎥 Watch video</a>
                    </div>
                    <div className="rounded-xl border bg-yellow-50 p-3 text-sm text-[var(--text-primary)]">
                      <span className="font-bold">👩🏽‍🏫 Classroom Activity:</span> {activity}
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        ) : null}
      </ProgressiveContent>

      {/* MCQ */}
      <ProgressiveContent isReady={isSectionReady("quiz")} fallback={<SectionSkeleton title="Quiz" lines={5} />}>
        {mcq.length > 0 ? (
          <section className="space-y-4">
            <h3 className="text-sm font-bold text-[var(--text-primary)]">📝 Multiple Choice Questions</h3>
            <div className="space-y-4">
              {mcq.map((q, i) => {
                const options: string[] = Array.isArray(q?.options) ? q.options : [];
                return (
                  <div key={i} className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-4 shadow-sm">
                    <div className="font-semibold text-[var(--text-primary)]">{i + 1}. {safeRender(q?.q || q?.question || "Question")}</div>
                    <div className="mt-3 space-y-2">
                      {options.slice(0, 4).map((opt, j) => (
                        <div key={j} className="flex items-start gap-3 text-sm text-[var(--text-primary)]">
                          <span className="font-bold text-violet-700 min-w-[22px]">{String.fromCharCode(65 + j)}.</span>
                          <span>{safeRender(opt)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        ) : null}
      </ProgressiveContent>

      {/* Theory */}
      <ProgressiveContent isReady={isSectionReady("quiz")} fallback={<SectionSkeleton title="Theory Questions" lines={5} />}>
        {theory.length > 0 ? (
          <section className="space-y-4">
            <h3 className="text-sm font-bold text-[var(--text-primary)]">✍️ Theory Questions</h3>
            <div className="space-y-4">
              {theory.map((q, i) => (
                <div key={i} className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-4 shadow-sm">
                  <div className="font-semibold text-[var(--text-primary)]">{i + 1}. {safeRender(q?.q || q?.question || "Question")}</div>
                  {q?.markingGuide && (
                    <div className="mt-3 rounded-xl border border-[var(--border)] bg-[var(--card-alt)] p-3">
                      <div className="text-xs font-semibold text-[var(--text-secondary)]">Marking Guide</div>
                      <div className="mt-1 text-sm text-[var(--text-secondary)]">{safeRender(q.markingGuide)}</div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </section>
        ) : null}
      </ProgressiveContent>

      {/* Real-life Applications */}
      <ProgressiveContent isReady={isSectionReady("applications")} fallback={null}>
        {liveApps.length > 0 ? (
          <section className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-4">
            <h3 className="text-sm font-bold text-[var(--text-primary)]">Real-life Applications</h3>
            <ul className="mt-2 list-disc pl-6 space-y-1 text-sm text-[var(--text-primary)]">
              {liveApps.map((x: any, i: number) => <li key={i}>{safeRender(x)}</li>)}
            </ul>
          </section>
        ) : null}
      </ProgressiveContent>
    </div>
  );
});

// ─────────────────────────────────────────────────────────────
// MAIN COMPONENT
// ─────────────────────────────────────────────────────────────

export default function LibraryPage() {
  const supabase = useMemo(() => createBrowserSupabase(), []);

  const [email, setEmail] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [lessons, setLessons] = useState<LessonRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [subjectFilter, setSubjectFilter] = useState<string>("all");
  const [gradeFilter, setGradeFilter] = useState<string>("all");
  const [sort, setSort] = useState<SortMode>("newest");
  const [active, setActive] = useState<LessonRow | null>(null);
  const [previewImage, setPreviewImage] = useState<{ src: string; title: string } | null>(null);
  const [lessonPlanFormOpen, setLessonPlanFormOpen] = useState(false);
  const [pdfTeacherName, setPdfTeacherName] = useState("");
  const [pdfSchoolName, setPdfSchoolName] = useState("");
  const [pdfLessonDate, setPdfLessonDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [isGeneratingLessonPlanPdf, setIsGeneratingLessonPlanPdf] = useState(false);

  const { data: activeWithPayload, isLoading: isLoadingLessonContent } = useLessonCache(active?.id ?? null);

  const resolvedLessonContent = useMemo(() => {
    if (!activeWithPayload || isLoadingLessonContent) return null;
    return resolveLessonContent(activeWithPayload);
  }, [activeWithPayload, isLoadingLessonContent]);

  const { isSectionReady } = useProgressiveRenderer(resolvedLessonContent);

  const canDownloadLessonPlan =
    !!active && active.type !== "slides" && !!resolvedLessonContent && !isLoadingLessonContent;

  // Stable callbacks — never recreated between renders
  const handlePreviewImage = useCallback((img: { src: string; title: string }) => {
    setPreviewImage(img);
  }, []);

  const handleDownloadImageCb = useCallback((src: string, title: string) => {
    handleDownloadImage(src, title);
    track("export_png_clicked", {
      user_role: "teacher",
      active_role: "teacher",
      subject: active?.subject,
      curriculum: active?.curriculum,
      generation_type: active?.type === "slides" ? "lesson_slides" : "lesson_pack",
    });
  }, [active]);

  const openLibraryItem = useCallback((row: LessonRow) => {
    setActive(row);
    track("library_item_opened", {
      user_role: "teacher",
      active_role: "teacher",
      subject: row.subject,
      curriculum: row.curriculum,
      generation_type: row.type === "slides" ? "lesson_slides" : "lesson_pack",
    });
  }, []);

  const handleDownloadStructure = useCallback(() => {
    handleDownloadLessonStructureFromRow(active);
  }, [active]);

  const handleOpenLessonPlanForm = useCallback(() => {
    if (!canDownloadLessonPlan) return;
    setLessonPlanFormOpen(true);
  }, [canDownloadLessonPlan]);

  const handleDownloadLessonPlanPdf = useCallback(async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!active || !resolvedLessonContent || isGeneratingLessonPlanPdf) return;

    const teacherName = pdfTeacherName.trim();
    const schoolName = pdfSchoolName.trim();
    const lessonDate = pdfLessonDate.trim();

    if (!teacherName || !schoolName || !lessonDate) {
      alert("Teacher full name, school name, and date of lesson are required.");
      return;
    }

    setIsGeneratingLessonPlanPdf(true);
    try {
      const meta = resolvedLessonContent?.meta ?? {};
      const subject = String(meta?.subject ?? active.subject ?? "");
      const grade = String(meta?.grade ?? active.grade ?? "");
      const topic = String(meta?.topic ?? active.topic ?? "");
      const durationValue = meta?.durationMins ?? meta?.duration ?? "";
      const duration = durationValue
        ? String(durationValue).toLowerCase().includes("minute")
          ? String(durationValue)
          : `${durationValue} minutes`
        : "";
      const filename = `${safeFilenamePart(subject, "Subject")}_${safeFilenamePart(
        grade,
        "Class"
      )}_${safeFilenamePart(topic, "Topic")}_LessonPlan.pdf`;

      const blob = await pdf(
        <LessonPlanPdfDocument
          lesson={resolvedLessonContent}
          meta={{
            teacherName,
            schoolName,
            lessonDate,
            subject,
            grade,
            topic,
            duration,
          }}
        />
      ).toBlob();

      downloadBlob(filename, blob);
      track("export_pdf_clicked", {
        user_role: "teacher",
        active_role: "teacher",
        subject,
        curriculum: active.curriculum,
        generation_type: "lesson_pack",
      });
      setLessonPlanFormOpen(false);
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : "Failed to generate lesson plan PDF.");
    } finally {
      setIsGeneratingLessonPlanPdf(false);
    }
  }, [
    active,
    isGeneratingLessonPlanPdf,
    pdfLessonDate,
    pdfSchoolName,
    pdfTeacherName,
    resolvedLessonContent,
  ]);

  const onDelete = useCallback(async (id: string) => {
    if (!confirm("Delete this lesson?")) return;
    setBusyId(id);
    try {
      const { error: delErr } = await supabase.from("lessons").delete().eq("id", id);
      if (delErr) throw delErr;
      setLessons((prev) => prev.filter((l) => l.id !== id));
      if (active?.id === id) setActive(null);
      // Invalidate cache so next load is fresh
      try { sessionStorage.removeItem(CACHE_KEY); } catch {}
    } catch (e: any) {
      alert(e?.message || "Delete failed");
    } finally {
      setBusyId(null);
    }
  }, [supabase, active]);

  // ── load ──────────────────────────────────────────────────
  // FIX 1: Check sessionStorage first → instant paint on return visits
  // FIX 2: Run session + lessons fetch in parallel with Promise.all
  async function load(forceRefresh = false) {
    // Serve from cache if recent enough and not a forced refresh
    if (!forceRefresh) {
      try {
        const raw = sessionStorage.getItem(CACHE_KEY);
        if (raw) {
          const parsed = JSON.parse(raw);
          if (Date.now() - (parsed.ts ?? 0) < CACHE_TTL && Array.isArray(parsed.lessons)) {
            setLessons(parsed.lessons);
            if (parsed.email) setEmail(parsed.email);
            setLoading(false);
            // Still refresh silently in background
            fetchFromNetwork(false);
            return;
          }
        }
      } catch {}
    }

    setLoading(true);
    await fetchFromNetwork(true);
  }

  async function fetchFromNetwork(showSpinner: boolean) {
    if (showSpinner) setLoading(true);
    setError(null);

    try {
      // FIX 2: both calls run at the same time — saves one full round-trip
      const [{ data: { user }, error: userErr }, { data, error: fetchErr }] = await Promise.all([
        supabase.auth.getUser(),
        supabase
          .from("lessons")
          .select("id, subject, topic, grade, curriculum, created_at, type")
          .order("created_at", { ascending: false })
          .limit(200),
      ]);

      if (userErr || !user) throw new Error("Session expired. Please login again.");

      if (fetchErr) throw fetchErr;

      const rows = (data ?? []) as LessonRow[];
      setEmail(user.email ?? "");
      setLessons(rows);

      // Persist to cache
      try {
        sessionStorage.setItem(CACHE_KEY, JSON.stringify({ lessons: rows, email: user.email ?? "", ts: Date.now() }));
      } catch {}
    } catch (e: any) {
      setError(e?.message || "Failed to load library");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── derived data ──────────────────────────────────────────

  const subjects = useMemo(() => {
    const set = new Set<string>();
    for (const l of lessons) if (l.subject) set.add(l.subject);
    return ["all", ...Array.from(set).sort((a, b) => a.localeCompare(b))];
  }, [lessons]);

  const grades = useMemo(() => {
    const set = new Set<string>();
    for (const l of lessons) if (l.grade) set.add(l.grade);
    return ["all", ...Array.from(set).sort((a, b) => a.localeCompare(b))];
  }, [lessons]);

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    return lessons
      .filter((l) => {
        const matchesText = !term ||
          (l.topic ?? "").toLowerCase().includes(term) ||
          (l.subject ?? "").toLowerCase().includes(term) ||
          (l.grade ?? "").toLowerCase().includes(term) ||
          (l.curriculum ?? "").toLowerCase().includes(term);
        const matchesSubject = subjectFilter === "all" || (l.subject ?? "") === subjectFilter;
        const matchesGrade = gradeFilter === "all" || (l.grade ?? "") === gradeFilter;
        return matchesText && matchesSubject && matchesGrade;
      })
      .sort((a, b) => {
        const da = new Date(a.created_at).getTime();
        const db = new Date(b.created_at).getTime();
        return sort === "newest" ? db - da : da - db;
      });
  }, [lessons, q, subjectFilter, gradeFilter, sort]);

  // ── render ────────────────────────────────────────────────

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[var(--text-primary)]">My Lesson Library</h1>
          <p className="mt-1 text-sm text-[var(--text-secondary)]">Search, reuse, and review your saved lessons.</p>
          {email && (
            <div className="mt-1 text-xs text-[var(--text-tertiary)]">
              Signed in as <span className="font-semibold text-[var(--text-secondary)]">{email}</span>
            </div>
          )}
        </div>
        <button
          onClick={() => load(true)}
          className="w-full rounded-xl border border-[var(--border)] bg-[var(--card)] px-3 py-2 text-sm font-medium text-[var(--text-primary)] hover:bg-slate-100 md:w-auto"
        >
          Refresh
        </button>
      </div>

      {/* Controls */}
      <div className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-4 shadow-sm">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
          <div className="md:col-span-2">
            <div className="mb-1 text-xs font-medium text-[var(--text-secondary)]">Search by subject, topic, grade...</div>
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="e.g., Inflation, CRK, Grade 10..."
              className="w-full rounded-xl border border-[var(--border)] bg-[var(--card)] px-3 py-2 text-sm outline-none focus:border-violet-400"
            />
          </div>
          <div>
            <div className="mb-1 text-xs font-medium text-[var(--text-secondary)]">Subject</div>
            <select value={subjectFilter} onChange={(e) => setSubjectFilter(e.target.value)}
              className="w-full rounded-xl border border-[var(--border)] bg-[var(--card)] px-3 py-2 text-sm outline-none focus:border-violet-400">
              {subjects.map((s) => <option key={s} value={s}>{s === "all" ? "All subjects" : s}</option>)}
            </select>
          </div>
          <div>
            <div className="mb-1 text-xs font-medium text-[var(--text-secondary)]">Grade</div>
            <select value={gradeFilter} onChange={(e) => setGradeFilter(e.target.value)}
              className="w-full rounded-xl border border-[var(--border)] bg-[var(--card)] px-3 py-2 text-sm outline-none focus:border-violet-400">
              {grades.map((g) => <option key={g} value={g}>{g === "all" ? "All grades" : g}</option>)}
            </select>
          </div>
          <div>
            <div className="mb-1 text-xs font-medium text-[var(--text-secondary)]">Sort</div>
            <select value={sort} onChange={(e) => setSort(e.target.value as SortMode)}
              className="w-full rounded-xl border border-[var(--border)] bg-[var(--card)] px-3 py-2 text-sm outline-none focus:border-violet-400">
              <option value="newest">Newest first</option>
              <option value="oldest">Oldest first</option>
            </select>
          </div>
          <div className="md:col-span-3">
            <div className="rounded-xl bg-[var(--card-alt)] p-3 text-xs text-[var(--text-secondary)]">
              🔒 Your library is private to your account (RLS). Avoid student names or sensitive info.
            </div>
          </div>
          <div className="flex items-center justify-between rounded-xl border border-[var(--border)] bg-[var(--card)] p-3 text-xs text-[var(--text-secondary)]">
            <span>Total</span>
            <span className="font-semibold">{filtered.length}</span>
          </div>
        </div>
      </div>

      {/* Errors / Loading */}
      {error && (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div>
      )}
      {loading && (
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-6 text-sm text-[var(--text-secondary)]">
          Loading your library...
        </div>
      )}
      {!loading && filtered.length === 0 && (
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-6 text-sm text-[var(--text-secondary)]">
          No lessons found. Generate one first.
        </div>
      )}

      {/* Grid */}
      {!loading && filtered.length > 0 && (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          {filtered.map((l) => (
            <div key={l.id} className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-4 shadow-sm">
              <div className="flex items-start justify-between gap-3">
                <div>
                 <div className="flex flex-wrap gap-2">
                    {l.subject && <span className="rounded-full bg-violet-50 px-3 py-1 text-xs font-semibold text-violet-700">{l.subject}</span>}
                    {l.grade && <span className="rounded-full bg-[var(--card-alt)] px-3 py-1 text-xs font-semibold text-[var(--text-secondary)]">{l.grade}</span>}
                    {l.type === "slides" && (
                      <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-600">🖥️ Slides</span>
                    )}
                    {(!l.type || l.type === "lesson") && (
                      <span className="rounded-full bg-violet-50 px-3 py-1 text-xs font-semibold text-violet-700">📋 Lesson Pack</span>
                    )}
                  </div>
                  <div className="mt-3 text-lg font-bold text-[var(--text-primary)]">{l.topic || "Untitled lesson"}</div>
                  <div className="mt-1 text-xs text-[var(--text-tertiary)]">{timeAgo(l.created_at)}</div>
                </div>
                <button onClick={() => openLibraryItem(l)}
                  className="rounded-xl border border-[var(--border)] bg-[var(--card)] px-3 py-2 text-xs font-semibold text-[var(--text-primary)] hover:bg-slate-100">
                  View
                </button>
              </div>
              <div className="mt-4 flex items-center justify-between">
                <button onClick={() => openLibraryItem(l)}
                  className="rounded-xl bg-violet-600 px-3 py-2 text-xs font-semibold text-white shadow-sm hover:bg-violet-700">
                  Open
                </button>
                <button onClick={() => onDelete(l.id)} disabled={busyId === l.id}
                  className="rounded-xl border border-red-200 bg-[var(--card)] px-3 py-2 text-xs font-semibold text-red-700 hover:bg-red-50 disabled:opacity-60">
                  {busyId === l.id ? "Deleting..." : "Delete"}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Lesson Modal */}
      {active && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-[96vw] max-w-6xl h-[92vh] bg-[var(--card)] rounded-2xl shadow-2xl flex flex-col overflow-hidden">
            {/* Modal header */}
            <div className="flex items-start justify-between gap-4 border-b border-[var(--border)] p-4">
              <div>
                <div className="text-lg font-bold text-[var(--text-primary)]">{active.topic || "Lesson"}</div>
                <div className="mt-1 text-xs text-[var(--text-tertiary)]">
                  {active.subject || "—"} • {active.grade || "—"} • {timeAgo(active.created_at)}
                </div>
              </div>
              <div className="flex items-center gap-2">
                {active.type !== "slides" && (
                  <button
                    onClick={handleOpenLessonPlanForm}
                    disabled={!canDownloadLessonPlan}
                    className="rounded-xl border border-[var(--border)] bg-[var(--card)] px-3 py-2 text-xs font-semibold text-[var(--text-primary)] hover:bg-slate-100 disabled:opacity-60"
                  >
                    Download Lesson Plan
                  </button>
                )}
                <button onClick={handleDownloadStructure}
                  className="rounded-xl border border-[var(--border)] bg-[var(--card)] px-3 py-2 text-xs font-semibold text-[var(--text-primary)] hover:bg-slate-100">
                  Download Structure
                </button>
                <button onClick={() => setActive(null)}
                  className="rounded-xl border border-[var(--border)] bg-[var(--card)] px-3 py-2 text-xs font-semibold text-[var(--text-primary)] hover:bg-slate-100">
                  Close
                </button>
              </div>
            </div>

            {/* Modal body */}
           <div className="max-h-[70vh] overflow-auto p-4">
              {isLoadingLessonContent ? (
                <LessonSkeleton />
              ) : active.type === "slides" ? (
                (() => {
                  const raw =
  activeWithPayload?.result_json ??
  (activeWithPayload as any)?.content ??
  active.result_json ??
  (active as any).content ??
  null;
                 const candidate =
  raw?.deck ??
  raw?.data?.deck ??
  raw;

const slideDeck = {
  deck_title:
    candidate?.deck_title ??
    candidate?.meta?.topic ??
    active.topic ??
    "Lesson",

  subject:
    candidate?.subject ??
    candidate?.meta?.subject ??
    active.subject ??
    "",

  grade:
    candidate?.grade ??
    candidate?.meta?.grade ??
    active.grade ??
    "",

  bloom_level:
    candidate?.bloom_level ??
    candidate?.meta?.bloom ??
    "",

  slides:
    candidate?.slides ??
    [],
};
                  if (!Array.isArray(slideDeck.slides) || slideDeck.slides.length === 0) {
                    return (
                      <div className="p-6 text-center text-sm text-[var(--text-secondary)]">
                        Slide deck content could not be loaded.
                      </div>
                    );
                  }
                  return <SlideViewer deck={slideDeck as any} />;
                })()
              ) : resolvedLessonContent ? (
                <LessonPreview
                  gen={resolvedLessonContent}
                  fallbackSubject={activeWithPayload?.subject ?? active.subject ?? ""}
                  fallbackTopic={activeWithPayload?.topic ?? active.topic ?? ""}
                  isReady
                  isSectionReady={isSectionReady}
                  onPreviewImage={handlePreviewImage}
                  onDownloadImage={handleDownloadImageCb}
                />
              ) : (
                <div className="rounded-xl border border-[var(--border)] bg-[var(--card-alt)] p-6 text-center space-y-3">
                  <div className="text-sm font-medium text-[var(--text-secondary)]">No content available</div>
                  <div className="text-xs text-[var(--text-secondary)]">This lesson doesn't have saved content yet. Delete and regenerate it.</div>
                </div>
              )}
            </div>

            {/* Modal footer */}
            <div className="flex items-center justify-end gap-2 border-t border-[var(--border)] p-4">
              <button onClick={() => onDelete(active.id)} disabled={busyId === active.id}
                className="rounded-xl border border-red-200 bg-[var(--card)] px-3 py-2 text-xs font-semibold text-red-700 hover:bg-red-50 disabled:opacity-60">
                {busyId === active.id ? "Deleting..." : "Delete"}
              </button>
              <button onClick={() => setActive(null)}
                className="rounded-xl bg-violet-600 px-3 py-2 text-xs font-semibold text-white shadow-sm hover:bg-violet-700">
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      {lessonPlanFormOpen && active && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-2xl bg-[var(--card)] p-5 shadow-2xl">
            <div className="mb-4">
              <div className="text-lg font-bold text-[var(--text-primary)]">
                Download Lesson Plan
              </div>
              <div className="mt-1 text-xs text-[var(--text-secondary)]">
                Add the school submission details for this PDF.
              </div>
            </div>

            <form onSubmit={handleDownloadLessonPlanPdf} className="space-y-4">
              <div>
                <label className="mb-1 block text-xs font-medium text-[var(--text-secondary)]">
                  Teacher full name
                </label>
                <input
                  value={pdfTeacherName}
                  onChange={(e) => setPdfTeacherName(e.target.value)}
                  required
                  className="w-full rounded-xl border border-[var(--border)] bg-[var(--card)] px-3 py-2 text-sm text-[var(--text-primary)] outline-none focus:border-violet-400"
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium text-[var(--text-secondary)]">
                  School name
                </label>
                <input
                  value={pdfSchoolName}
                  onChange={(e) => setPdfSchoolName(e.target.value)}
                  required
                  className="w-full rounded-xl border border-[var(--border)] bg-[var(--card)] px-3 py-2 text-sm text-[var(--text-primary)] outline-none focus:border-violet-400"
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium text-[var(--text-secondary)]">
                  Date of lesson
                </label>
                <input
                  type="date"
                  value={pdfLessonDate}
                  onChange={(e) => setPdfLessonDate(e.target.value)}
                  required
                  className="w-full rounded-xl border border-[var(--border)] bg-[var(--card)] px-3 py-2 text-sm text-[var(--text-primary)] outline-none focus:border-violet-400"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setLessonPlanFormOpen(false)}
                  disabled={isGeneratingLessonPlanPdf}
                  className="rounded-xl border border-[var(--border)] bg-[var(--card)] px-3 py-2 text-xs font-semibold text-[var(--text-primary)] hover:bg-slate-100 disabled:opacity-60"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isGeneratingLessonPlanPdf}
                  className="rounded-xl bg-violet-600 px-3 py-2 text-xs font-semibold text-white shadow-sm hover:bg-violet-700 disabled:opacity-60"
                >
                  {isGeneratingLessonPlanPdf ? "Preparing..." : "Download PDF"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Image Preview Modal */}
      {previewImage && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 p-4">
          <div className="w-full max-w-5xl rounded-2xl bg-[var(--card)] p-4 shadow-2xl">
            <div className="mb-4 flex items-center justify-between gap-3">
              <div className="text-base font-bold text-[var(--text-primary)]">{previewImage.title}</div>
              <div className="flex items-center gap-2">
                <button type="button" onClick={() => handleDownloadImage(previewImage.src, previewImage.title)}
                  className="rounded-lg border border-[var(--border)] bg-[var(--card)] px-3 py-2 text-sm font-semibold text-[var(--text-primary)] hover:bg-slate-100">
                  Download
                </button>
                <button type="button" onClick={() => setPreviewImage(null)}
                  className="rounded-lg bg-slate-900 px-3 py-2 text-sm font-semibold text-white hover:bg-slate-700">
                  Close
                </button>
              </div>
            </div>
            <div className="max-h-[75vh] overflow-auto rounded-xl border bg-[var(--card-alt)] p-2">
              <img src={previewImage.src} alt={previewImage.title} className="mx-auto h-auto max-w-full rounded-lg" />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
