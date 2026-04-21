"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { createBrowserSupabase } from "@/lib/supabase/browser";
import { youtubeSearchUrl } from "@/lib/media";
import { resolveLessonContent } from "@/lib/lessons/resolveLessonContent";
import { LessonPageSkeleton } from "@/lib/lessons/LessonSkeleton";

type LessonRow = {
  id: string;
  subject: string | null;
  topic: string | null;
  grade: string | null;
  curriculum: string | null;
  created_at?: string | null;
  result_json: any;
};

const FALLBACK_IMG =
  "https://images.unsplash.com/photo-1524995997946-a1c2e315a42f?w=1200";

export default function LessonPage() {
  const router = useRouter();
  const params = useParams();
  const supabase = useMemo(() => createBrowserSupabase(), []);

  const lessonId = Array.isArray((params as any)?.id)
    ? (params as any).id[0]
    : (params as any)?.id;

  const [loading, setLoading] = useState(true);
  const [row, setRow] = useState<LessonRow | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [previewImage, setPreviewImage] = useState<{
    src: string;
    title: string;
  } | null>(null);

  useEffect(() => {
    let alive = true;

    (async () => {
      try {
        setMsg(null);

        const { data: auth } = await supabase.auth.getUser();
        if (!alive) return;

        if (!auth?.user) {
          router.push("/login");
          return;
        }

        if (!lessonId) {
          setMsg("Missing lesson id.");
          setLoading(false);
          return;
        }

        const { data, error } = await supabase
          .from("lessons")
          .select("id, subject, topic, grade, curriculum, created_at, result_json")
          .eq("id", lessonId)
          .single();

        if (!alive) return;

        if (error) {
          setMsg(`Failed to load lesson: ${error.message}`);
          setRow(null);
        } else {
          setRow(data as LessonRow);
        }
      } catch (e: any) {
        setMsg(e?.message ?? "Unknown error");
      } finally {
        if (alive) setLoading(false);
      }
    })();

    return () => {
      alive = false;
    };
  }, [lessonId, router, supabase]);

  useEffect(() => {
  if (!row) return;

  const result = row.result_json ?? {};
  const meta = result?.meta ?? {};

  (window as any).__FORGE_CONTEXT__ = {
    page: "lesson",
    lessonId: row.id,
    currentLesson: {
      id: row.id,
      subject: meta?.subject ?? row.subject,
      topic: meta?.topic ?? row.topic,
      grade: meta?.grade ?? row.grade,
      curriculum: meta?.curriculum ?? row.curriculum,
      schoolLevel: meta?.schoolLevel ?? "",
      numberOfSlides: meta?.numberOfSlides ?? "",
      durationMins: meta?.durationMins ?? "",
      lessonPlan: result?.lessonPlan ?? null,
      lessonNotes: result?.lessonNotes ?? {},
      references: result?.references ?? [],
      slides: Array.isArray(result?.slides) ? result.slides : [],
      quiz: result?.quiz ?? {},
      liveApplications: result?.liveApplications ?? [],
    },
    hasLoadedLesson: true,
  };

  return () => {
    const current = (window as any).__FORGE_CONTEXT__;
    if (current?.page === "lesson") {
      delete (window as any).__FORGE_CONTEXT__;
    }
  };
}, [row]);

  function downloadFile(
    filename: string,
    content: string,
    type = "text/plain;charset=utf-8"
  ) {
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

  function handleDownloadImage(src: string, title: string) {
    const a = document.createElement("a");
    a.href = src;
    a.download = `${
      title.replace(/[^\w\s-]/g, "").trim().replace(/\s+/g, "_") || "slide-image"
    }.png`;
    document.body.appendChild(a);
    a.click();
    a.remove();
  }

  function safeRender(value: any): React.ReactNode {
  if (value === null || value === undefined) return null;

  if (
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean"
  ) {
    return String(value);
  }

  if (Array.isArray(value)) {
    return (
      <ul className="list-disc pl-6 space-y-1">
        {value.map((item, i) => (
          <li key={i}>{safeRender(item)}</li>
        ))}
      </ul>
    );
  }

  if (typeof value === "object") {
    if ("question" in value || "markingGuide" in value) {
      return (
        <div className="space-y-2">
          {"question" in value ? (
            <div className="text-sm text-slate-800">
              {safeRender(value.question)}
            </div>
          ) : null}

          {"markingGuide" in value ? (
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
              <div className="text-xs font-semibold text-slate-700">
                Marking Guide
              </div>
              <div className="mt-1 text-sm text-slate-700">
                {safeRender(value.markingGuide)}
              </div>
            </div>
          ) : null}
        </div>
      );
    }

    return (
      <div className="space-y-2">
        {Object.entries(value).map(([key, val]) => (
          <div key={key}>
            <div className="text-xs font-semibold uppercase text-slate-600">
              {key}
            </div>
            <div className="text-sm text-slate-800">{safeRender(val)}</div>
          </div>
        ))}
      </div>
    );
  }

  return String(value);
}

  function buildLessonStructureText() {
    if (!row) return "";

    const result = row.result_json ?? {};
    const meta = result?.meta ?? {};
    const lessonPlan = result?.lessonPlan ?? {};
    const slides = Array.isArray(result?.slides) ? result.slides : [];
    const mcq = Array.isArray(result?.quiz?.mcq) ? result.quiz.mcq : [];
    const theory = Array.isArray(result?.quiz?.theory) ? result.quiz.theory : [];
    const liveApps = Array.isArray(result?.liveApplications)
      ? result.liveApplications
      : [];

    const lines: string[] = [];

    lines.push("LESSONFORGE LESSON / CURRICULUM STRUCTURE REPORT");
    lines.push("=".repeat(55));
    lines.push("");
    lines.push(`Subject: ${meta.subject ?? row.subject ?? ""}`);
    lines.push(`Topic: ${meta.topic ?? row.topic ?? ""}`);
    lines.push(`Class: ${meta.grade ?? row.grade ?? ""}`);
    lines.push(`Curriculum: ${meta.curriculum ?? row.curriculum ?? ""}`);
    lines.push(`School Level: ${meta.schoolLevel ?? ""}`);
    lines.push(`Number of Slides: ${meta.numberOfSlides ?? slides.length ?? 0}`);
    lines.push(`Duration: ${meta.durationMins ?? ""} minutes`);
    lines.push("");

    if (lessonPlan?.title) {
      lines.push("LESSON PLAN TITLE");
      lines.push("-".repeat(20));
      lines.push(String(lessonPlan.title));
      lines.push("");
    }

    if (
      Array.isArray(lessonPlan?.performanceObjectives) &&
      lessonPlan.performanceObjectives.length
    ) {
      lines.push("PERFORMANCE OBJECTIVES");
      lines.push("-".repeat(24));
      lessonPlan.performanceObjectives.forEach((item: string, i: number) => {
        lines.push(`${i + 1}. ${item}`);
      });
      lines.push("");
    }

    if (
      Array.isArray(lessonPlan?.instructionalMaterials) &&
      lessonPlan.instructionalMaterials.length
    ) {
      lines.push("INSTRUCTIONAL MATERIALS");
      lines.push("-".repeat(23));
      lessonPlan.instructionalMaterials.forEach((item: string, i: number) => {
        lines.push(`${i + 1}. ${item}`);
      });
      lines.push("");
    }

    if (lessonPlan?.previousKnowledge) {
      lines.push("PREVIOUS KNOWLEDGE");
      lines.push("-".repeat(18));
      lines.push(String(lessonPlan.previousKnowledge));
      lines.push("");
    }

    if (lessonPlan?.introduction) {
      lines.push("INTRODUCTION");
      lines.push("-".repeat(12));
      lines.push(String(lessonPlan.introduction));
      lines.push("");
    }

    if (Array.isArray(lessonPlan?.steps) && lessonPlan.steps.length) {
      lines.push("LESSON DELIVERY STEPS");
      lines.push("-".repeat(21));
      lessonPlan.steps.forEach((step: any, i: number) => {
        lines.push(`Step ${step?.step ?? i + 1}: ${step?.title ?? "Lesson Step"}`);
        if (step?.teacherActivity) {
          lines.push(`Teacher Activity: ${step.teacherActivity}`);
        }
        if (step?.learnerActivity) {
          lines.push(`Learner Activity: ${step.learnerActivity}`);
        }
        if (step?.concretisedLearningPoint) {
          lines.push(`Learning Point: ${step.concretisedLearningPoint}`);
        }
        lines.push("");
      });
    }

    if (Array.isArray(lessonPlan?.evaluation) && lessonPlan.evaluation.length) {
      lines.push("EVALUATION");
      lines.push("-".repeat(10));
      lessonPlan.evaluation.forEach((item: string, i: number) => {
        lines.push(`${i + 1}. ${item}`);
      });
      lines.push("");
    }

    if (Array.isArray(lessonPlan?.assignment) && lessonPlan.assignment.length) {
      lines.push("ASSIGNMENT");
      lines.push("-".repeat(10));
      lessonPlan.assignment.forEach((item: string, i: number) => {
        lines.push(`${i + 1}. ${item}`);
      });
      lines.push("");
    }

    if (
      Array.isArray(lessonPlan?.realLifeConnection) &&
      lessonPlan.realLifeConnection.length
    ) {
      lines.push("REAL-LIFE CONNECTION");
      lines.push("-".repeat(20));
      lessonPlan.realLifeConnection.forEach((item: string, i: number) => {
        lines.push(`${i + 1}. ${item}`);
      });
      lines.push("");
    }

    if (result?.lessonNotes) {
      lines.push("LESSON NOTES");
      lines.push("-".repeat(12));
      lines.push(String(result.lessonNotes));
      lines.push("");
    }

    if (slides.length) {
      lines.push("SLIDE STRUCTURE");
      lines.push("-".repeat(15));
      slides.forEach((slide: any, i: number) => {
        lines.push(`${i + 1}. ${slide?.title ?? `Slide ${i + 1}`}`);
        const bullets = Array.isArray(slide?.bullets) ? slide.bullets : [];
        bullets.forEach((b: string) => lines.push(`- ${b}`));
        if (slide?.interactivePrompt) {
          lines.push(`Activity: ${slide.interactivePrompt}`);
        }
        if (slide?.imageQuery) {
          lines.push(`Image Focus: ${slide.imageQuery}`);
        }
        if (slide?.videoQuery) {
          lines.push(`Video Search: ${slide.videoQuery}`);
        }
        lines.push("");
      });
    }

    if (mcq.length) {
      lines.push("MULTIPLE CHOICE QUESTIONS");
      lines.push("-".repeat(25));
      mcq.forEach((item: any, i: number) => {
        lines.push(`${i + 1}. ${item?.q ?? "Question"}`);
        const options = Array.isArray(item?.options) ? item.options : [];
        options.forEach((opt: string, j: number) => {
          lines.push(`   ${String.fromCharCode(65 + j)}. ${opt}`);
        });
        if (typeof item?.answerIndex === "number") {
          lines.push(`   Answer: ${String.fromCharCode(65 + item.answerIndex)}`);
        }
        lines.push("");
      });
    }

    if (theory.length) {
      lines.push("THEORY QUESTIONS");
      lines.push("-".repeat(16));
      theory.forEach((item: any, i: number) => {
        lines.push(`${i + 1}. ${item?.q ?? "Question"}`);
        if (item?.markingGuide) {
          lines.push(`Marking Guide: ${item.markingGuide}`);
        }
        lines.push("");
      });
      lines.push("");
    }

    if (liveApps.length) {
      lines.push("LIVE / REAL-WORLD APPLICATIONS");
      lines.push("-".repeat(30));
      liveApps.forEach((item: string, i: number) => {
        lines.push(`${i + 1}. ${item}`);
      });
      lines.push("");
    }

    lines.push("Generated with LessonForge");
    return lines.join("\n");
  }

  function handleDownloadLessonStructure() {
    if (!row) return;

    const result = row.result_json ?? {};
    const meta = result?.meta ?? {};

    const safeSubject = String(meta?.subject ?? row.subject ?? "subject")
      .replace(/[^\w\s-]/g, "")
      .trim()
      .replace(/\s+/g, "_");

    const safeTopic = String(meta?.topic ?? row.topic ?? "topic")
      .replace(/[^\w\s-]/g, "")
      .trim()
      .replace(/\s+/g, "_");

    const content = buildLessonStructureText();
    downloadFile(`LessonForge_${safeSubject}_${safeTopic}_Structure.txt`, content);
  }

  if (loading) {
    return <LessonPageSkeleton />;
  }

  if (!row) {
    return (
      <div className="mx-auto max-w-5xl space-y-4 p-6 text-slate-900 md:p-10">
        <div className="rounded-2xl border bg-white p-6">
          <div className="text-lg font-bold">Couldn’t load lesson</div>
          <div className="mt-1 text-sm text-slate-700">
            {msg ?? "Unknown error"}
          </div>

          <div className="mt-4 flex gap-2">
            <Link
              href="/dashboard"
              className="rounded-xl border bg-white px-4 py-2 font-medium hover:bg-slate-50"
            >
              Back to Dashboard
            </Link>
            <Link
              href="/"
              className="rounded-xl border bg-white px-4 py-2 font-medium hover:bg-slate-50"
            >
              New Lesson
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const result = row.result_json ?? {};
  const meta = result?.meta ?? {};
  const lessonPlan = result?.lessonPlan ?? null;
  const slides: any[] = Array.isArray(result?.slides) ? result.slides : [];
  const quiz = result?.quiz ?? {};
  const mcq: any[] = Array.isArray(quiz?.mcq) ? quiz.mcq : [];
  const theory: any[] = Array.isArray(quiz?.theory) ? quiz.theory : [];
  const liveApps: string[] = Array.isArray(result?.liveApplications)
    ? result.liveApplications
    : [];

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-6 text-slate-900 md:p-10">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">
            {meta?.subject ?? row.subject}
            {(meta?.topic ?? row.topic) ? ` • ${meta?.topic ?? row.topic}` : ""}
          </h1>
          <p className="mt-1 text-sm text-slate-700">
            <span className="font-medium">{meta?.grade ?? row.grade}</span>
            {meta?.curriculum ?? row.curriculum ? (
              <>
                {" "}
                • Curriculum:{" "}
                <span className="font-medium">
                  {meta?.curriculum ?? row.curriculum}
                </span>
              </>
            ) : null}
            {meta?.schoolLevel ? (
              <>
                {" "}
                • Level: <span className="font-medium">{meta.schoolLevel}</span>
              </>
            ) : null}
            {meta?.numberOfSlides ? (
              <>
                {" "}
                • Slides:{" "}
                <span className="font-medium">{meta.numberOfSlides}</span>
              </>
            ) : null}
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={handleDownloadLessonStructure}
            className="rounded-xl border bg-white px-4 py-2 font-medium hover:bg-slate-50"
          >
            Download Structure
          </button>
          <Link
            href="/dashboard"
            className="rounded-xl border bg-white px-4 py-2 font-medium hover:bg-slate-50"
          >
            Back
          </Link>
          <Link
            href="/"
            className="rounded-xl border bg-white px-4 py-2 font-medium hover:bg-slate-50"
          >
            New Lesson
          </Link>
        </div>
      </div>

      {lessonPlan ? (
        <section className="rounded-2xl border bg-white p-5 space-y-5">
          <h2 className="text-xl font-semibold">Lesson Plan</h2>

          {lessonPlan?.title ? (
            <div>
              <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Title
              </div>
              <div className="mt-1 text-sm text-slate-800">{safeRender(lessonPlan.title)}</div>
            </div>
          ) : null}

          {Array.isArray(lessonPlan?.performanceObjectives) &&
          lessonPlan.performanceObjectives.length ? (
            <div>
              <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Performance Objectives
              </div>
              <ul className="mt-2 list-disc pl-6 space-y-1 text-sm text-slate-800">
              {lessonPlan.performanceObjectives.map((item: any, i: number) => (
  <li key={i}>{safeRender(item)}</li>
))}
              </ul>
            </div>
          ) : null}

          {Array.isArray(lessonPlan?.instructionalMaterials) &&
          lessonPlan.instructionalMaterials.length ? (
            <div>
              <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Instructional Materials
              </div>
              <ul className="mt-2 list-disc pl-6 space-y-1 text-sm text-slate-800">
                {lessonPlan.instructionalMaterials.map((item: any, i: number) => (
  <li key={i}>{safeRender(item)}</li>
))}
              </ul>
            </div>
          ) : null}

          {lessonPlan?.previousKnowledge ? (
            <div>
              <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Previous Knowledge
              </div>
              <div className="mt-1 whitespace-pre-wrap text-sm text-slate-800">
                {safeRender(lessonPlan.previousKnowledge)}
              </div>
            </div>
          ) : null}

          {lessonPlan?.introduction ? (
            <div>
              <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Introduction
              </div>
              <div className="mt-1 whitespace-pre-wrap text-sm text-slate-800">
               {safeRender(lessonPlan.introduction)}
              </div>
            </div>
          ) : null}

          {Array.isArray(lessonPlan?.steps) && lessonPlan.steps.length ? (
            <div className="space-y-3">
              <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Lesson Delivery Steps
              </div>

              {lessonPlan.steps.map((step: any, i: number) => (
                <div
                  key={i}
                  className="rounded-xl border border-slate-200 bg-slate-50 p-4 space-y-2"
                >
                  <div className="font-semibold text-slate-900">
                    Step {step?.step ?? i + 1}: {safeRender(step?.title || "Lesson Step")}
                  </div>

                  {step?.teacherActivity ? (
                    <div className="text-sm text-slate-800">
                      <span className="font-semibold">Teacher Activity:</span>{" "}
                      {safeRender(step.teacherActivity)}
                    </div>
                  ) : null}

                  {step?.learnerActivity ? (
                    <div className="text-sm text-slate-800">
                      <span className="font-semibold">Learner Activity:</span>{" "}
                      {safeRender(step.learnerActivity)}
                    </div>
                  ) : null}

                  {step?.concretisedLearningPoint ? (
                    <div className="text-sm text-slate-800">
                      <span className="font-semibold">Learning Point:</span>{" "}
                      {safeRender(step.concretisedLearningPoint)}
                    </div>
                  ) : null}
                </div>
              ))}
            </div>
          ) : null}

          {Array.isArray(lessonPlan?.evaluation) && lessonPlan.evaluation.length ? (
            <div>
              <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Evaluation
              </div>
              <div className="mt-2 space-y-3">
                {lessonPlan.evaluation.map((item: any, i: number) => (
                  <div key={i} className="rounded-lg border border-slate-200 p-3">
                    {typeof item === "object" && item?.question ? (
                      <>
                        <p className="text-sm font-medium text-slate-800">{item.question}</p>
                        {item.questionType && (
                          <p className="mt-1 text-xs text-slate-600 uppercase">
                            Type: {item.questionType}
                          </p>
                        )}
                        {item.markingGuide && (
                          <p className="mt-2 text-sm text-slate-700">
                            <span className="font-medium">Marking Guide:</span> {item.markingGuide}
                          </p>
                        )}
                      </>
                    ) : (
                      <p className="text-sm text-slate-800">{safeRender(item)}</p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          {Array.isArray(lessonPlan?.assignment) && lessonPlan.assignment.length ? (
            <div>
              <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Assignment
              </div>
              <ul className="mt-2 list-disc pl-6 space-y-1 text-sm text-slate-800">
               {lessonPlan.assignment.map((item: any, i: number) => (
  <li key={i}>{safeRender(item)}</li>
))}
              </ul>
            </div>
          ) : null}

          {Array.isArray(lessonPlan?.realLifeConnection) &&
          lessonPlan.realLifeConnection.length ? (
            <div>
              <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Real-life Connection
              </div>
              <ul className="mt-2 list-disc pl-6 space-y-1 text-sm text-slate-800">
                {lessonPlan.realLifeConnection.map((item: any, i: number) => (
  <li key={i}>{safeRender(item)}</li>
))}
              </ul>
            </div>
          ) : null}
        </section>
      ) : null}

      <section className="rounded-2xl border bg-white p-5">
        <h2 className="mb-3 text-xl font-semibold">Lesson Notes</h2>
        {result?.lessonNotes ? (
          typeof result.lessonNotes === "string" ? (
            <div className="whitespace-pre-wrap leading-relaxed text-slate-900">
              {safeRender(result.lessonNotes)}
            </div>
          ) : (
            <div className="space-y-4">
              {result.lessonNotes.introduction && (
                <div>
                  <p className="text-sm font-semibold text-slate-800">Introduction</p>
                  <p className="mt-1 text-sm text-slate-700 leading-relaxed">
                    {result.lessonNotes.introduction}
                  </p>
                </div>
              )}
              {result.lessonNotes.keyConcepts?.length ? (
                <div>
                  <p className="text-sm font-semibold text-slate-800">Key Concepts</p>
                  <div className="mt-2 space-y-3">
                    {result.lessonNotes.keyConcepts.map((concept: any, i: number) => (
                      <div key={i} className="border-l-2 border-violet-200 pl-3">
                        <p className="text-sm font-medium text-slate-800">
                          {concept.subheading || `Concept ${i + 1}`}
                        </p>
                        {concept.content && (
                          <p className="mt-1 text-sm text-slate-700">{concept.content}</p>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}
              {result.lessonNotes.workedExamples?.length ? (
                <div>
                  <p className="text-sm font-semibold text-slate-800">Worked Examples</p>
                  <div className="mt-2 space-y-4">
                    {result.lessonNotes.workedExamples.map((example: any, i: number) => (
                      <div key={i} className="rounded-lg border border-slate-200 p-3">
                        <p className="text-sm font-medium text-slate-800">
                          {example.title || `Example ${i + 1}`}
                        </p>
                        {example.problem && (
                          <p className="mt-1 text-sm text-slate-700">
                            <span className="font-medium">Problem:</span> {example.problem}
                          </p>
                        )}
                        {example.steps?.length ? (
                          <div className="mt-2">
                            <p className="text-sm font-medium text-slate-800">Steps:</p>
                            <ol className="mt-1 list-decimal pl-5 space-y-1 text-sm text-slate-700">
                              {example.steps.map((step: any, j: number) => (
                                <li key={j}>{step}</li>
                              ))}
                            </ol>
                          </div>
                        ) : null}
                        {example.finalAnswer && (
                          <p className="mt-2 text-sm text-slate-700">
                            <span className="font-medium">Final Answer:</span> {example.finalAnswer}
                          </p>
                        )}
                        {example.explanation && (
                          <p className="mt-2 text-sm text-slate-700">
                            <span className="font-medium">Explanation:</span> {example.explanation}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}
              {result.lessonNotes.summaryPoints?.length ? (
                <div>
                  <p className="text-sm font-semibold text-slate-800">Summary Points</p>
                  <ul className="mt-2 list-disc pl-5 space-y-1 text-sm text-slate-700">
                    {result.lessonNotes.summaryPoints.map((point: any, i: number) => (
                      <li key={i}>{point}</li>
                    ))}
                  </ul>
                </div>
              ) : null}
              {result.lessonNotes.keyVocabulary?.length ? (
                <div>
                  <p className="text-sm font-semibold text-slate-800">Key Vocabulary</p>
                  <div className="mt-2 space-y-2">
                    {result.lessonNotes.keyVocabulary.map((item: any, i: number) => (
                      <div key={i} className="flex gap-2 text-sm">
                        <span className="font-medium text-slate-800 min-w-0 flex-1">
                          {item.word}
                        </span>
                        <span className="text-slate-600">:</span>
                        <span className="text-slate-700 flex-1">{item.meaning}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>
          )
        ) : (
          <p className="text-sm text-slate-500">No lesson notes found.</p>
        )}
      </section>

      {Array.isArray(result?.references) && result.references.length ? (
  <section className="rounded-2xl border bg-white p-5">
    <h2 className="mb-4 text-xl font-semibold">References</h2>

    <ul className="list-disc pl-6 space-y-1 text-sm text-slate-800">
     {result.references.map((ref: any, i: number) => (
  <li key={i}>{safeRender(ref)}</li>
))}
    </ul>
  </section>
) : null}

      <section className="rounded-2xl border bg-white p-5">
        <h2 className="mb-4 text-xl font-semibold">Slides</h2>

        {slides.length ? (
          <div className="grid gap-4">
            {slides.map((s: any, i: number) => {
              const title = s?.title || `Slide ${i + 1}`;
              const bullets: string[] = Array.isArray(s?.bullets) ? s.bullets : [];
              const imgSrc = s?.image || FALLBACK_IMG;
              const videoQuery = s?.videoQuery || title || row.topic || "";

              return (
                <div key={i} className="rounded-xl border p-4 bg-slate-50">
                  <div className="mb-3 flex items-center justify-between gap-3">
                    <div className="font-semibold text-slate-900">
                      {i + 1}. {title}
                    </div>
                    <span className="rounded-full border bg-white px-2 py-1 text-xs text-slate-700">
                      Slide {i + 1}
                    </span>
                  </div>

                  <div className="rounded-xl overflow-hidden border bg-white mb-3">
                    <button
                      type="button"
                      onClick={() => setPreviewImage({ src: imgSrc, title })}
                      className="block w-full text-left"
                    >
                      <img
                        src={imgSrc}
                        alt={title}
                        className="h-48 w-full object-cover transition hover:scale-[1.01]"
                        loading="lazy"
                        referrerPolicy="no-referrer"
                        onError={(e) => {
                          e.currentTarget.src = FALLBACK_IMG;
                        }}
                      />
                    </button>
                  </div>

                  <div className="mb-3 flex flex-wrap gap-3 text-sm">
                    <button
                      type="button"
                      onClick={() => setPreviewImage({ src: imgSrc, title })}
                      className="rounded-lg border border-slate-200 bg-white px-3 py-2 font-semibold text-slate-800 hover:bg-slate-100"
                    >
                      View full image
                    </button>

                    <button
                      type="button"
                      onClick={() => handleDownloadImage(imgSrc, title)}
                      className="rounded-lg border border-slate-200 bg-white px-3 py-2 font-semibold text-slate-800 hover:bg-slate-100"
                    >
                      Download image
                    </button>
                  </div>

                  {bullets.length ? (
                    <ul className="list-disc pl-6 space-y-1">
                     {bullets.map((b: any, j: number) => (
  <li key={j}>{safeRender(b)}</li>
))}
                    </ul>
                  ) : (
                    <p className="text-sm text-slate-700">No bullet points.</p>
                  )}

                  <div className="mt-3 flex flex-wrap gap-3 text-sm">
                    {videoQuery ? (
                      <a
                        href={youtubeSearchUrl(videoQuery)}
                        target="_blank"
                        rel="noreferrer"
                        className="font-semibold text-blue-600 underline"
                      >
                        🎥 Watch video
                      </a>
                    ) : null}
                  </div>

                  {s?.interactivePrompt ? (
                    <div className="mt-3 rounded-xl border bg-yellow-50 p-3 text-sm">
                     <b>👩🏽‍🏫 Classroom Activity:</b> {safeRender(s.interactivePrompt)}
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
        ) : (
          <p className="text-sm text-slate-700">No slides found.</p>
        )}
      </section>

      <section className="rounded-2xl border bg-white p-5">
        <h2 className="mb-4 text-xl font-semibold">Student Questions</h2>

        {mcq.length ? (
          <div className="space-y-4">
            {mcq.map((q: any, i: number) => (
              <div key={i} className="rounded-xl border p-4 bg-slate-50">
                <div className="mb-2 font-semibold">
                  {i + 1}. {safeRender(q?.q || q?.question || "Question")}
                </div>
                <ul className="list-disc pl-6 space-y-1">
                  {(Array.isArray(q?.options) ? q.options : []).map(
                    (opt: string, j: number) => (
                      <li key={j}>{safeRender(opt)}</li>
                    )
                  )}
                </ul>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-slate-700">
            No multiple choice questions found.
          </p>
        )}

        {theory.length ? (
          <div className="mt-6 space-y-4">
            <h3 className="text-lg font-semibold">Theory</h3>
            {theory.map((t: any, i: number) => (
              <div key={i} className="rounded-xl border p-4 bg-slate-50">
                <div className="font-semibold">
                  {i + 1}. {safeRender(t?.q || t?.question || "Theory question")}
                </div>
                {t?.markingGuide ? (
                  <div className="mt-2 text-sm text-slate-700">
                    <b>Marking guide:</b> {safeRender(t.markingGuide)}
                  </div>
                ) : null}
              </div>
            ))}
          </div>
        ) : null}

        {liveApps.length ? (
          <div className="mt-6 space-y-2">
            <h3 className="text-lg font-semibold">Real-life Applications</h3>
            <ul className="list-disc pl-6 space-y-1">
             {liveApps.map((item: any, i: number) => (
  <li key={i}>{safeRender(item)}</li>
))}
            </ul>
          </div>
        ) : null}
      </section>

      {previewImage ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="w-full max-w-5xl rounded-2xl bg-white p-4 shadow-2xl">
            <div className="mb-4 flex items-center justify-between gap-3">
              <div className="text-base font-bold text-slate-900">
                {previewImage.title}
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() =>
                    handleDownloadImage(previewImage.src, previewImage.title)
                  }
                  className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-800 hover:bg-slate-100"
                >
                  Download
                </button>

                <button
                  type="button"
                  onClick={() => setPreviewImage(null)}
                  className="rounded-lg bg-slate-900 px-3 py-2 text-sm font-semibold text-white hover:bg-slate-700"
                >
                  Close
                </button>
              </div>
            </div>

            <div className="max-h-[75vh] overflow-auto rounded-xl border bg-slate-50 p-2">
              <img
                src={previewImage.src}
                alt={previewImage.title}
                className="mx-auto h-auto max-w-full rounded-lg"
              />
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}