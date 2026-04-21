"use client";

import { useEffect, useMemo, useState } from "react";
import { createBrowserSupabase } from "@/lib/supabase/browser";
import { resolveLessonContent } from "@/lib/lessons/resolveLessonContent";
import { LessonSkeleton } from "@/lib/lessons/LessonSkeleton";
import { useLessonCache } from "@/lib/lessons/useLessonCache";
import { useProgressiveRenderer, SectionSkeleton, ProgressiveContent } from "@/lib/lessons/ProgressiveRenderer";
 

type LessonRow = {
  id: string;
  subject: string | null;
  topic: string | null;
  grade: string | null;
  curriculum: string | null;

  // ✅ FIX: your DB uses result_json (jsonb) not content
  result_json: any | null;

  // (optional) keep compatibility for any older code/rows you might still have
  content?: any | null;

  created_at: string;
};

type SortMode = "newest" | "oldest";

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
  
  // Use the new lesson cache hook for instant loading and deduplication
  const { data: activeWithPayload, isLoading: isLoadingLessonContent, error: lessonError } = useLessonCache(active?.id ?? null);
  
  // Memoize resolved lesson content at top level (MUST be here, not in JSX)
  // This ensures hooks always run in the same order
  const resolvedLessonContent = useMemo(() => {
    if (!activeWithPayload || isLoadingLessonContent) return null;
    return resolveLessonContent(activeWithPayload);
  }, [activeWithPayload, isLoadingLessonContent]);
  
  // Progressive rendering for content sections
  const { isSectionReady } = useProgressiveRenderer(resolvedLessonContent);

  async function load() {
    setLoading(true);
    setError(null);

    try {
      const {
        data: { user },
        error: userErr,
      } = await supabase.auth.getUser();

      if (userErr || !user) throw new Error("Session expired. Please login again.");
      setEmail(user.email ?? "");

      // ✅ FIX: Fetch only summary fields for list view, not large result_json
      const { data, error: fetchErr } = await supabase
        .from("lessons")
        .select("id, subject, topic, grade, curriculum, created_at")
        .order("created_at", { ascending: false })
        .limit(200);

      if (fetchErr) throw fetchErr;

      setLessons((data ?? []) as LessonRow[]);
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

  function safeRender(value: any): React.ReactNode {
  if (value === null || value === undefined) return null;

  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
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
              <div className="text-xs font-semibold text-slate-700">Marking Guide</div>
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
            <div className="text-xs font-semibold text-slate-600 uppercase">{key}</div>
            <div className="text-sm text-slate-800">{safeRender(val)}</div>
          </div>
        ))}
      </div>
    );
  }

  return String(value);
}

  function LessonPreview({
  gen,
  fallbackSubject,
  fallbackTopic,
  isReady = true,
  isSectionReady = () => true,
}: {
  gen: any;
  fallbackSubject: string;
  fallbackTopic: string;
  isReady?: boolean;
  isSectionReady?: (section: string) => boolean;
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
      {/* Meta header - ALWAYS visible immediately */}
      <div className="rounded-2xl border border-slate-200 bg-white p-4">
        <div className="text-xs text-slate-500">Lesson Pack</div>
        <div className="mt-1 text-xl font-extrabold text-slate-900">{topic || "Lesson"}</div>
        <div className="mt-1 text-sm text-slate-600">
          {subject ? <span className="font-semibold text-slate-800">{subject}</span> : null}
          {meta?.grade ? <span> • {meta.grade}</span> : null}
          {meta?.curriculum ? <span> • {meta.curriculum}</span> : null}
          {meta?.durationMins ? <span> • {meta.durationMins} mins</span> : null}
        </div>
      </div>

            {/* Lesson Plan - loads quickly, high priority */}
      <ProgressiveContent
        isReady={isSectionReady("lessonPlan")}
        fallback={<SectionSkeleton title="Lesson Plan" />}
      >
        {lessonPlan ? (
          <section className="rounded-2xl border border-slate-200 bg-white p-4 space-y-5">
            <h3 className="text-sm font-bold text-slate-900">Lesson Plan</h3>

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
              <div className="mt-2 space-y-2">
                {lessonPlan.evaluation.map((item: any, i: number) => (
                  <div key={i} className="rounded border border-slate-200 p-2">
                    {typeof item === "object" && item?.question ? (
                      <>
                        <p className="text-sm font-medium text-slate-800">{item.question}</p>
                        {item.questionType && (
                          <p className="text-xs text-slate-600 uppercase">Type: {item.questionType}</p>
                        )}
                        {item.markingGuide && (
                          <p className="mt-1 text-sm text-slate-700">
                            <span className="font-medium">Guide:</span> {item.markingGuide}
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
      </ProgressiveContent>
      
      {/* Lesson Notes - medium priority */}
      <ProgressiveContent
        isReady={isSectionReady("notes")}
        fallback={<SectionSkeleton title="Lesson Notes" />}
      >
        {gen?.lessonNotes ? (
          <section className="rounded-2xl border border-slate-200 bg-white p-4">
            <h3 className="text-sm font-bold text-slate-900">Lesson Notes</h3>
          <div className="mt-2">
            {typeof gen.lessonNotes === "string" ? (
              <div className="whitespace-pre-wrap text-sm text-slate-800 leading-relaxed">
                {safeRender(gen.lessonNotes)}
              </div>
            ) : (
              <div className="space-y-3">
                {gen.lessonNotes.introduction && (
                  <div>
                    <p className="text-xs font-semibold text-slate-700 uppercase">Introduction</p>
                    <p className="mt-1 text-sm text-slate-800 leading-relaxed">
                      {gen.lessonNotes.introduction}
                    </p>
                  </div>
                )}
                {gen.lessonNotes.keyConcepts?.length ? (
                  <div>
                    <p className="text-xs font-semibold text-slate-700 uppercase">Key Concepts</p>
                    <div className="mt-2 space-y-2">
                      {gen.lessonNotes.keyConcepts.map((concept: any, i: number) => (
                        <div key={i} className="border-l-2 border-violet-200 pl-2">
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
                {gen.lessonNotes.workedExamples?.length ? (
                  <div>
                    <p className="text-xs font-semibold text-slate-700 uppercase">Worked Examples</p>
                    <div className="mt-2 space-y-3">
                      {gen.lessonNotes.workedExamples.map((example: any, i: number) => (
                        <div key={i} className="rounded border border-slate-200 p-2">
                          <p className="text-sm font-medium text-slate-800">
                            {example.title || `Example ${i + 1}`}
                          </p>
                          {example.problem && (
                            <p className="mt-1 text-sm text-slate-700">
                              <span className="font-medium">Problem:</span> {example.problem}
                            </p>
                          )}
                          {example.steps?.length ? (
                            <ol className="mt-1 list-decimal pl-5 text-sm text-slate-700">
                              {example.steps.map((step: any, j: number) => (
                                <li key={j}>{step}</li>
                              ))}
                            </ol>
                          ) : null}
                          {example.finalAnswer && (
                            <p className="mt-1 text-sm text-slate-700">
                              <span className="font-medium">Answer:</span> {example.finalAnswer}
                            </p>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                ) : null}
                {gen.lessonNotes.summaryPoints?.length ? (
                  <div>
                    <p className="text-xs font-semibold text-slate-700 uppercase">Summary Points</p>
                    <ul className="mt-2 list-disc pl-5 text-sm text-slate-800">
                      {gen.lessonNotes.summaryPoints.map((point: any, i: number) => (
                        <li key={i}>{point}</li>
                      ))}
                    </ul>
                  </div>
                ) : null}
                {gen.lessonNotes.keyVocabulary?.length ? (
                  <div>
                    <p className="text-xs font-semibold text-slate-700 uppercase">Key Vocabulary</p>
                    <div className="mt-2 space-y-1">
                      {gen.lessonNotes.keyVocabulary.map((item: any, i: number) => (
                        <div key={i} className="flex gap-2 text-sm">
                          <span className="font-medium text-slate-800">{item.word}</span>
                          <span className="text-slate-600">:</span>
                          <span className="text-slate-700">{item.meaning}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : null}
              </div>
            )}
          </div>
        </section>
      ) : null}
      </ProgressiveContent>

      {/* Slides - can be large, medium priority */}
      <ProgressiveContent
        isReady={isSectionReady("slides")}
        fallback={<SectionSkeleton title="Slides" lines={4} />}
      >
        {slides.length ? (
          <section className="space-y-4">
            <h3 className="text-sm font-bold text-slate-900">Slides</h3>

          <div className="grid gap-6">
            {slides.map((s, i) => {
              const title = s?.title || `Slide ${i + 1}`;
              const bullets: string[] = Array.isArray(s?.bullets) ? s.bullets : [];
              const videoQuery = s?.videoQuery || title || `${subject} ${topic}`;
              const activity = s?.interactivePrompt || "No interactive activity provided.";
              const img =
                s?.image ||
                "https://images.unsplash.com/photo-1524995997946-a1c2e315a42f?w=1200";

              return (
                <div
                  key={i}
                  className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm space-y-4"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="text-lg font-bold text-slate-900">
                      {i + 1}. {title}
                    </div>
                    <span className="text-[11px] font-semibold px-2 py-1 rounded-full border bg-slate-50 text-slate-700">
                      Slide {i + 1}
                    </span>
                  </div>

                  {/* Image */}
                <div className="rounded-xl overflow-hidden border bg-slate-100">
  <button
    type="button"
    onClick={() => setPreviewImage({ src: img, title })}
    className="block w-full text-left"
  >
    <img
      src={img}
      alt={title}
      className="w-full h-48 object-cover transition hover:scale-[1.01]"
      onError={(e) => {
        e.currentTarget.src =
          "https://images.unsplash.com/photo-1524995997946-a1c2e315a42f?w=1200";
      }}
    />
  </button>
</div>
<div className="flex flex-wrap gap-3 text-sm">
  <button
    type="button"
    onClick={() => setPreviewImage({ src: img, title })}
    className="rounded-lg border border-slate-200 bg-white px-3 py-2 font-semibold text-slate-800 hover:bg-slate-100"
  >
    View full image
  </button>

  <button
    type="button"
    onClick={() => handleDownloadImage(img, title)}
    className="rounded-lg border border-slate-200 bg-white px-3 py-2 font-semibold text-slate-800 hover:bg-slate-100"
  >
    Download image
  </button>
</div>
                  {/* Bullets */}
                  {bullets.length ? (
                    <ul className="list-disc pl-6 space-y-2 text-slate-800 font-medium">
                      {bullets.map((b, j) => (
                        <li key={j}>{safeRender(b)}</li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-sm text-slate-600">No bullet points.</p>
                  )}

                  {/* Video link */}
                  <div className="flex flex-wrap gap-4 text-sm">
                    <a
                      href={youtubeSearchUrl(videoQuery)}
                      target="_blank"
                      rel="noreferrer"
                      className="text-blue-600 font-semibold hover:underline"
                    >
                      🎥 Watch video
                    </a>
                  </div>

                  {/* Activity */}
                  <div className="rounded-xl border bg-yellow-50 p-3 text-sm text-slate-900">
                    <span className="font-bold">👩🏽‍🏫 Classroom Activity:</span> {activity}
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      ) : null}
      </ProgressiveContent>

      {/* MCQ - medium priority */}
      <ProgressiveContent
        isReady={isSectionReady("quiz")}
        fallback={<SectionSkeleton title="Quiz" lines={5} />}
      >
        {mcq.length ? (
          <section className="space-y-4">
            <h3 className="text-sm font-bold text-slate-900">📝 Multiple Choice Questions</h3>

          <div className="space-y-4">
            {mcq.map((q, i) => {
              const options: string[] = Array.isArray(q?.options) ? q.options : [];
              return (
                <div key={i} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                  <div className="font-semibold text-slate-900">
                    {i + 1}. {safeRender(q?.q || q?.question || "Question")}
                  </div>

                  <div className="mt-3 space-y-2">
                    {options.slice(0, 4).map((opt, j) => (
                      <div key={j} className="flex items-start gap-3 text-sm text-slate-800">
                        <span className="font-bold text-violet-700 min-w-[22px]">
                          {String.fromCharCode(65 + j)}.
                        </span>
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

      {/* Theory - medium priority */}
      <ProgressiveContent
        isReady={isSectionReady("quiz")}
        fallback={<SectionSkeleton title="Theory Questions" lines={5} />}
      >
        {theory.length ? (
          <section className="space-y-4">
            <h3 className="text-sm font-bold text-slate-900">✍️ Theory Questions</h3>
          <div className="space-y-4">
            {theory.map((q, i) => (
              <div key={i} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                <div className="font-semibold text-slate-900">
                  {i + 1}. {safeRender(q?.q || q?.question || "Question")}
                </div>

                {q?.markingGuide ? (
                  <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50 p-3">
                    <div className="text-xs font-semibold text-slate-700">Marking Guide</div>
                    <div className="mt-1 text-sm text-slate-700">{safeRender(q.markingGuide)}</div>
                  </div>
                ) : null}
              </div>
            ))}
          </div>
        </section>
      ) : null}
      </ProgressiveContent>

      {/* Real-life applications - optional, low priority */}
      <ProgressiveContent
        isReady={isSectionReady("applications")}
        fallback={null}
      >
        {liveApps.length ? (
          <section className="rounded-2xl border border-slate-200 bg-white p-4">
            <h3 className="text-sm font-bold text-slate-900">Real-life Applications</h3>
          <ul className="mt-2 list-disc pl-6 space-y-1 text-sm text-slate-800">
           {liveApps.map((x: any, i: number) => (
  <li key={i}>{safeRender(x)}</li>
))}
          </ul>
        </section>
      ) : null}
      </ProgressiveContent>
    </div>
  );
}

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

    let out = lessons.filter((l) => {
      const matchesText =
        !term ||
        (l.topic ?? "").toLowerCase().includes(term) ||
        (l.subject ?? "").toLowerCase().includes(term) ||
        (l.grade ?? "").toLowerCase().includes(term) ||
        (l.curriculum ?? "").toLowerCase().includes(term);

      const matchesSubject = subjectFilter === "all" || (l.subject ?? "") === subjectFilter;
      const matchesGrade = gradeFilter === "all" || (l.grade ?? "") === gradeFilter;

      return matchesText && matchesSubject && matchesGrade;
    });

    out = out.sort((a, b) => {
      const da = new Date(a.created_at).getTime();
      const db = new Date(b.created_at).getTime();
      return sort === "newest" ? db - da : da - db;
    });

    return out;
  }, [lessons, q, subjectFilter, gradeFilter, sort]);

  async function onDelete(id: string) {
    if (!confirm("Delete this lesson?")) return;

    setBusyId(id);
    try {
      const { error: delErr } = await supabase.from("lessons").delete().eq("id", id);
      if (delErr) throw delErr;

      setLessons((prev) => prev.filter((l) => l.id !== id));
      if (active?.id === id) setActive(null);
    } catch (e: any) {
      alert(e?.message || "Delete failed");
    } finally {
      setBusyId(null);
    }
  }

  // ✅ Helper: Always prefer result_json; fallback to content for older rows
  function getLessonPayload(row: LessonRow | null) {
    if (!row) return null;
    const raw = row.result_json ?? row.content ?? null;

    if (!raw) return null;

    // If it's accidentally stored as string JSON, parse it safely
    if (typeof raw === "string") {
      try {
        return JSON.parse(raw);
      } catch {
        return raw; // show as string
      }
    }

    return raw; // json object
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

  function handleDownloadImage(src: string, title: string) {
    const a = document.createElement("a");
    a.href = src;
    a.download = `${title.replace(/[^\w\s-]/g, "").trim().replace(/\s+/g, "_") || "slide-image"}.png`;
    document.body.appendChild(a);
    a.click();
    a.remove();
  }

  function buildLessonStructureTextFromRow(row: LessonRow | null) {
    const gen = resolveLessonContent(row);
    if (!gen || !row) return "";

    const meta = gen?.meta ?? {};
    const lessonPlan = gen?.lessonPlan ?? {};
    const slides = Array.isArray(gen?.slides) ? gen.slides : [];
    const mcq = Array.isArray(gen?.quiz?.mcq) ? gen.quiz.mcq : [];
    const theory = Array.isArray(gen?.quiz?.theory) ? gen.quiz.theory : [];
    const liveApps = Array.isArray(gen?.liveApplications) ? gen.liveApplications : [];

    const subject = meta?.subject ?? row.subject ?? "";
    const topic = meta?.topic ?? row.topic ?? "";
    const grade = meta?.grade ?? row.grade ?? "";
    const curriculum = meta?.curriculum ?? row.curriculum ?? "";
    const schoolLevel = meta?.schoolLevel ?? "";
    const numberOfSlides = meta?.numberOfSlides ?? slides.length ?? 0;
    const durationMins = meta?.durationMins ?? "";

    const lines: string[] = [];

    lines.push("LESSONFORGE LESSON / CURRICULUM STRUCTURE REPORT");
    lines.push("=".repeat(55));
    lines.push("");
    lines.push(`Subject: ${subject}`);
    lines.push(`Topic: ${topic}`);
    lines.push(`Class: ${grade}`);
    lines.push(`Curriculum: ${curriculum}`);
    lines.push(`School Level: ${schoolLevel}`);
    lines.push(`Number of Slides: ${numberOfSlides}`);
    lines.push(`Duration: ${durationMins} minutes`);
    lines.push("");

    if (lessonPlan?.title) {
      lines.push("LESSON PLAN TITLE");
      lines.push("-".repeat(20));
      lines.push(String(lessonPlan.title));
      lines.push("");
    }

    if (Array.isArray(lessonPlan?.performanceObjectives) && lessonPlan.performanceObjectives.length) {
      lines.push("PERFORMANCE OBJECTIVES");
      lines.push("-".repeat(24));
      lessonPlan.performanceObjectives.forEach((item: string, i: number) => {
        lines.push(`${i + 1}. ${item}`);
      });
      lines.push("");
    }

    if (Array.isArray(lessonPlan?.instructionalMaterials) && lessonPlan.instructionalMaterials.length) {
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
        if (step?.teacherActivity) lines.push(`Teacher Activity: ${step.teacherActivity}`);
        if (step?.learnerActivity) lines.push(`Learner Activity: ${step.learnerActivity}`);
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

    if (Array.isArray(lessonPlan?.realLifeConnection) && lessonPlan.realLifeConnection.length) {
      lines.push("REAL-LIFE CONNECTION");
      lines.push("-".repeat(20));
      lessonPlan.realLifeConnection.forEach((item: string, i: number) => {
        lines.push(`${i + 1}. ${item}`);
      });
      lines.push("");
    }

    if (gen?.lessonNotes) {
      if (typeof gen.lessonNotes === "string") {
        lines.push("LESSON NOTES");
        lines.push("-".repeat(12));
        lines.push(String(gen.lessonNotes));
        lines.push("");
      } else {
        if (gen.lessonNotes.introduction) {
          lines.push("LESSON NOTES INTRODUCTION");
          lines.push("-".repeat(25));
          lines.push(gen.lessonNotes.introduction);
          lines.push("");
        }
        if (gen.lessonNotes.keyConcepts?.length) {
          lines.push("KEY CONCEPTS");
          lines.push("-".repeat(13));
          gen.lessonNotes.keyConcepts.forEach((concept: any, i: number) => {
            lines.push(`${i + 1}. ${concept.subheading || "Concept"}`);
            if (concept.content) lines.push(`   ${concept.content}`);
            lines.push("");
          });
        }
        if (gen.lessonNotes.workedExamples?.length) {
          lines.push("WORKED EXAMPLES");
          lines.push("-".repeat(15));
          gen.lessonNotes.workedExamples.forEach((example: any, i: number) => {
            lines.push(`${i + 1}. ${example.title || "Example"}`);
            if (example.problem) lines.push(`   Problem: ${example.problem}`);
            if (example.steps?.length) {
              lines.push("   Steps:");
              example.steps.forEach((step: any, j: number) => lines.push(`     ${j + 1}. ${step}`));
            }
            if (example.finalAnswer) lines.push(`   Final Answer: ${example.finalAnswer}`);
            if (example.explanation) lines.push(`   Explanation: ${example.explanation}`);
            lines.push("");
          });
        }
        if (gen.lessonNotes.summaryPoints?.length) {
          lines.push("SUMMARY POINTS");
          lines.push("-".repeat(14));
          gen.lessonNotes.summaryPoints.forEach((point: any, i: number) => {
            lines.push(`${i + 1}. ${point}`);
          });
          lines.push("");
        }
        if (gen.lessonNotes.keyVocabulary?.length) {
          lines.push("KEY VOCABULARY");
          lines.push("-".repeat(14));
          gen.lessonNotes.keyVocabulary.forEach((item: any, i: number) => {
            lines.push(`${i + 1}. ${item.word || ""}: ${item.meaning || ""}`);
          });
          lines.push("");
        }
      }
    }

    if (slides.length) {
      lines.push("SLIDE STRUCTURE");
      lines.push("-".repeat(15));
      slides.forEach((slide: any, i: number) => {
        lines.push(`${i + 1}. ${slide?.title ?? `Slide ${i + 1}`}`);
        const bullets = Array.isArray(slide?.bullets) ? slide.bullets : [];
        bullets.forEach((b: string) => lines.push(`- ${b}`));
        if (slide?.interactivePrompt) lines.push(`Activity: ${slide.interactivePrompt}`);
        if (slide?.imageQuery) lines.push(`Image Focus: ${slide.imageQuery}`);
        if (slide?.videoQuery) lines.push(`Video Search: ${slide.videoQuery}`);
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
        if (item?.markingGuide) lines.push(`Marking Guide: ${item.markingGuide}`);
        lines.push("");
      });
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

  function handleDownloadLessonStructureFromRow(row: LessonRow | null) {
    if (!row) return;

    const gen = resolveLessonContent(row);
    const meta = gen?.meta ?? {};

    const safeSubject = String(meta?.subject ?? row.subject ?? "subject")
      .replace(/[^\w\s-]/g, "")
      .trim()
      .replace(/\s+/g, "_");

    const safeTopic = String(meta?.topic ?? row.topic ?? "topic")
      .replace(/[^\w\s-]/g, "")
      .trim()
      .replace(/\s+/g, "_");

    const content = buildLessonStructureTextFromRow(row);
    downloadFile(`LessonForge_${safeSubject}_${safeTopic}_Structure.txt`, content);
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">My Lesson Library</h1>
          <p className="mt-1 text-sm text-slate-600">
            Search, reuse, and review your saved lessons.
          </p>
          {email ? (
            <div className="mt-1 text-xs text-slate-500">
              Signed in as <span className="font-semibold text-slate-700">{email}</span>
            </div>
          ) : null}
        </div>

        <button
          onClick={load}
          className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-800 hover:bg-slate-100 md:w-auto"
        >
          Refresh
        </button>
      </div>

      {/* Controls */}
      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
          <div className="md:col-span-2">
            <div className="mb-1 text-xs font-medium text-slate-600">
              Search by subject, topic, grade...
            </div>
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="e.g., Inflation, CRK, Grade 10..."
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-violet-400"
            />
          </div>

          <div>
            <div className="mb-1 text-xs font-medium text-slate-600">Subject</div>
            <select
              value={subjectFilter}
              onChange={(e) => setSubjectFilter(e.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-violet-400"
            >
              {subjects.map((s) => (
                <option key={s} value={s}>
                  {s === "all" ? "All subjects" : s}
                </option>
              ))}
            </select>
          </div>

          <div>
            <div className="mb-1 text-xs font-medium text-slate-600">Grade</div>
            <select
              value={gradeFilter}
              onChange={(e) => setGradeFilter(e.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-violet-400"
            >
              {grades.map((g) => (
                <option key={g} value={g}>
                  {g === "all" ? "All grades" : g}
                </option>
              ))}
            </select>
          </div>

          <div>
            <div className="mb-1 text-xs font-medium text-slate-600">Sort</div>
            <select
              value={sort}
              onChange={(e) => setSort(e.target.value as SortMode)}
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-violet-400"
            >
              <option value="newest">Newest first</option>
              <option value="oldest">Oldest first</option>
            </select>
          </div>

          <div className="md:col-span-3">
            <div className="rounded-xl bg-slate-50 p-3 text-xs text-slate-600">
              🔒 Your library is private to your account (RLS). Avoid student names or sensitive info.
            </div>
          </div>

          <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-white p-3 text-xs text-slate-700">
            <span>Total</span>
            <span className="font-semibold">{filtered.length}</span>
          </div>
        </div>
      </div>

      {/* Errors / Loading */}
      {error ? (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {error}
        </div>
      ) : null}

      {loading ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-6 text-sm text-slate-600">
          Loading your library...
        </div>
      ) : null}

      {/* Grid */}
      {!loading && filtered.length === 0 ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-6 text-sm text-slate-600">
          No lessons found. Generate one first.
        </div>
      ) : null}

      {!loading && filtered.length > 0 ? (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          {filtered.map((l) => (
            <div key={l.id} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="flex flex-wrap gap-2">
                    {l.subject ? (
                      <span className="rounded-full bg-violet-50 px-3 py-1 text-xs font-semibold text-violet-700">
                        {l.subject}
                      </span>
                    ) : null}
                    {l.grade ? (
                      <span className="rounded-full bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-700">
                        {l.grade}
                      </span>
                    ) : null}
                  </div>

                  <div className="mt-3 text-lg font-bold text-slate-900">
                    {l.topic || "Untitled lesson"}
                  </div>

                  <div className="mt-1 text-xs text-slate-500">{timeAgo(l.created_at)}</div>
                </div>

                <button
                  onClick={() => setActive(l)}
                  className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-800 hover:bg-slate-100"
                >
                  View
                </button>
              </div>

              <div className="mt-4 flex items-center justify-between">
                <button
                  onClick={() => setActive(l)}
                  className="rounded-xl bg-violet-600 px-3 py-2 text-xs font-semibold text-white shadow-sm hover:bg-violet-700"
                >
                  Open
                </button>

                <button
                  onClick={() => onDelete(l.id)}
                  disabled={busyId === l.id}
                  className="rounded-xl border border-red-200 bg-white px-3 py-2 text-xs font-semibold text-red-700 hover:bg-red-50 disabled:opacity-60"
                >
                  {busyId === l.id ? "Deleting..." : "Delete"}
                </button>
              </div>
            </div>
          ))}
        </div>
      ) : null}

      {/* Modal */}
      {active ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-[96vw] max-w-6xl h-[92vh] bg-white rounded-2xl shadow-2xl flex flex-col overflow-hidden">
           <div className="flex items-start justify-between gap-4 border-b border-slate-200 p-4">
  <div>
    <div className="text-lg font-bold text-slate-900">{active.topic || "Lesson"}</div>
    <div className="mt-1 text-xs text-slate-500">
      {active.subject || "—"} • {active.grade || "—"} • {timeAgo(active.created_at)}
    </div>
  </div>

  <div className="flex items-center gap-2">
    <button
      onClick={() => handleDownloadLessonStructureFromRow(active)}
      className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-800 hover:bg-slate-100"
    >
      Download Structure
    </button>

    <button
      onClick={() => setActive(null)}
      className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-800 hover:bg-slate-100"
    >
      Close
    </button>
  </div>
  {previewImage ? (
  <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 p-4">
    <div className="w-full max-w-5xl rounded-2xl bg-white p-4 shadow-2xl">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div className="text-base font-bold text-slate-900">
          {previewImage.title}
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => handleDownloadImage(previewImage.src, previewImage.title)}
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
            <div className="max-h-[70vh] overflow-auto p-4">
              {!active ? null : isLoadingLessonContent ? (
                <LessonSkeleton />
              ) : resolvedLessonContent ? (
                <LessonPreview
                  gen={resolvedLessonContent}
                  fallbackSubject={activeWithPayload?.subject ?? active.subject ?? ""}
                  fallbackTopic={activeWithPayload?.topic ?? active.topic ?? ""}
                  isReady
                  isSectionReady={isSectionReady}
                />
              ) : (
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-6 text-center space-y-3">
                  <div className="text-sm font-medium text-slate-700">No content available</div>
                  <div className="text-xs text-slate-600">
                    This lesson doesn't have saved content yet. Delete and regenerate it.
                  </div>
                </div>
              )}
            </div>

            <div className="flex items-center justify-end gap-2 border-t border-slate-200 p-4">
              <button
                onClick={() => onDelete(active.id)}
                disabled={busyId === active.id}
                className="rounded-xl border border-red-200 bg-white px-3 py-2 text-xs font-semibold text-red-700 hover:bg-red-50 disabled:opacity-60"
              >
                {busyId === active.id ? "Deleting..." : "Delete"}
              </button>

              <button
                onClick={() => setActive(null)}
                className="rounded-xl bg-violet-600 px-3 py-2 text-xs font-semibold text-white shadow-sm hover:bg-violet-700"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
function youtubeSearchUrl(q: string) {
  return `https://www.youtube.com/results?search_query=${encodeURIComponent(q)}`;
}

function getGeneratedFromRow(row: LessonRow | null) {
  if (!row) return null;
  const raw = row.result_json ?? row.content ?? null;
  if (!raw) return null;

  if (typeof raw === "string") {
    try {
      return JSON.parse(raw);
    } catch {
      return null;
    }
  }
  return raw;
}

function safeStringify(v: any) {
  try {
    if (v === null || v === undefined) return ""; // ✅ never show "null"
    if (typeof v === "string") return v;
    return JSON.stringify(v, null, 2);
  } catch {
    return String(v ?? "");
  }
}

function timeAgo(iso: string) {
  const t = new Date(iso).getTime();
  const now = Date.now();
  const diff = Math.max(0, now - t);

  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins} min${mins === 1 ? "" : "s"} ago`;

  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs} hour${hrs === 1 ? "" : "s"} ago`;

  const days = Math.floor(hrs / 24);
  return `${days} day${days === 1 ? "" : "s"} ago`;
}

