"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createBrowserSupabase } from "@/lib/supabase/browser";
import { useProfile } from "@/lib/useProfile";
import TeacherPaywallModal from "@/components/billing/TeacherPaywallModal";
import { useNetworkStatus } from "@/components/network/NetworkProvider";
import { LESSON_PACK_CREDIT_COST } from "@/lib/billing/pricing";
import { getInvalidJsonMessage, readJsonResponse } from "@/lib/http/safe-json";
import { track } from "@/lib/analytics";
import { enrichGeneratedLessonImages } from "@/lib/generation/enrich-images-client";
import { renderLessonPackHTML } from "@/lib/export/renderLessonPack";
import { AlertCircle, CheckCircle2, Circle, Loader2, RotateCcw } from "lucide-react";

type VocabularyItem = {
  word?: string;
  simpleMeaning?: string;
};

type LessonVocabularyItem = {
  word?: string;
  meaning?: string;
};

type LessonStep = {
  stepNumber?: number;
  stepTitle?: string;
  step?: number;
  title?: string;
  timeMinutes?: number;
  teacherActivity?: string;
  learnerActivity?: string;
  guidedQuestions?: string[];
  teachingMethod?: string;
  assessmentCheck?: string;
  concretisedLearningPoint?: string;
};

type EvaluationItem = {
  question?: string;
  q?: string;
  questionType?: string;
  markingGuide?: string;
};

type TheoryItem = {
  question?: string;
  q?: string;
  markingGuide?: string;
};

type KeyConcept = {
  subheading?: string;
  content?: string;
};

type WorkedExample = {
  title?: string;
  problem?: string;
  steps?: string[];
  finalAnswer?: string;
  explanation?: string;
};

type LessonNotes = {
  introduction?: string;
  keyConcepts?: KeyConcept[];
  workedExamples?: WorkedExample[];
  realLifeApplications?: string[];
  summaryPoints?: string[];
  exitTicket?: string[];
  keyVocabulary?: LessonVocabularyItem[];
};

type SubjectEnrichment = {
  isCalculationBased?: boolean;
  coreFormulas?: Array<{
    name?: string;
    formula?: string;
    meaning?: string;
    units?: string;
  }>;
  symbolsAndUnits?: Array<{
    symbol?: string;
    meaning?: string;
    unit?: string;
  }>;
  calculationRules?: string[];
  extraWorkedExamples?: WorkedExample[];
  commonCalculationMistakes?: string[];
};

type Generated = {
  lessonPlan?: {
    lessonTitle?: string;
    title?: string;
    performanceObjectives?: string[];
    successCriteria?: string[];
    instructionalMaterials?: string[];
    lifeNatureActivities?: string[];
    crossCurricularActivities?: string[];
    keyVocabulary?: VocabularyItem[];
    commonMisconceptions?: string[];
    previousKnowledge?: string;
    introduction?: string;
    steps?: LessonStep[];
    differentiation?: {
      supportForStrugglingLearners?: string;
      supportForAverageLearners?: string;
      challengeForAdvancedLearners?: string;
    };
    evaluation?: Array<EvaluationItem | string>;
    exitTicket?: string[];
    assignment?: string[];
    boardSummary?: string[];
    realLifeApplications?: string[];
    realLifeConnection?: string[];
  };
  meta?: {
    subject?: string;
    topic?: string;
    grade?: string;
    curriculum?: string;
    examAlignment?: string;
    schoolLevel?: string;
    numberOfSlides?: number;
    durationMins?: number;
    lessonType?: string;
    academicDepth?: string;
    stage?: number;
    generationMeta?: GenerationMetadata;
  };
  lessonNotes?: LessonNotes | string;
  subjectEnrichment?: SubjectEnrichment;
  references?: string[];
  slides?: Array<{
    slideNumber?: number;
    slideType?: string;
    title?: string;
    bullets?: string[];
    teacherPrompt?: string;
    studentTask?: string;
    image?: string;
    image_url?: string | null;
    image_alt?: string;
    image_credit?: string;
    imageQuery?: string;
    image_query?: string;
    visual_suggestion?: string;
    videoQuery?: string;
    video_query?: string;
    interactivePrompt?: string;
  }>;
  quiz?: {
    mcq?: Array<{
      q?: string;
      options?: string[];
      answerIndex?: number;
      explanation?: string;
    }>;
    theory?: TheoryItem[];
  };
  liveApplications?: string[];
};

type GenerationMetadata = {
  subject: string;
  topic: string;
  grade: string;
  curriculum: string;
  examAlignment?: string;
  examBoard?: string;
  schoolLevel: string;
  numberOfSlides: number;
  durationMins: number;
  age?: string;
  usePersonalCredits?: boolean;
};

type FailedStage = 2 | 3;
type GeneratedSlide = NonNullable<Generated["slides"]>[number];

const STAGED_PROGRESS_STEPS = [
  "Generating lesson plan",
  "Writing lesson notes",
  "Creating quiz and questions",
  "Preparing slides",
  "Saving to library",
];

const CURRICULUM_OPTIONS = [
  "Nigerian Curriculum",
  "British Curriculum",
  "American Curriculum",
  "British-Nigerian Blended Curriculum",
  "American-Nigerian Blended Curriculum",
  "Turkish Curriculum",
];

const SCHOOL_LEVEL_OPTIONS = [
  { label: "EYFS / Nursery", value: "EYFS" },
  { label: "Primary", value: "Primary" },
  { label: "Secondary", value: "Secondary" },
];

function youtubeSearchUrl(query: string) {
  const q = (query || "").trim();
  return `https://www.youtube.com/results?search_query=${encodeURIComponent(q)}`;
}

function getSlideImageSrc(slide: GeneratedSlide | undefined) {
  return slide?.image_url || slide?.image || null;
}

function shuffleArray<T>(arr: T[]) {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => (typeof item === "string" ? item.trim() : ""))
    .filter(Boolean);
}

function getLessonTitle(result: Generated | null, subject: string, topic: string) {
  return (
    result?.lessonPlan?.lessonTitle ||
    result?.lessonPlan?.title ||
    `${subject} - ${topic}`
  );
}

function getRealLifeItems(result: Generated | null): string[] {
  return (
    result?.lessonPlan?.realLifeApplications ??
    result?.lessonPlan?.realLifeConnection ??
    []
  );
}
export default function GeneratePage() {
  const router = useRouter();
  const supabase = useMemo(() => createBrowserSupabase(), []);
  const { creditsRemaining, planLabel, loading: profileLoading } = useProfile();

  const [curriculum, setCurriculum] = useState("Nigerian Curriculum");
  const [schoolLevel, setSchoolLevel] = useState("Secondary");
  const [subject, setSubject] = useState("");
  const [grade, setGrade] = useState("");
  const [age, setAge] = useState("");                          // ← NEW
  const [topic, setTopic] = useState("");
  const [numberOfSlides, setNumberOfSlides] = useState(4);    // ← default 4

  const [durationMins] = useState(40);

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [downloadingPack, setDownloadingPack] = useState(false); // ← NEW
  const { isOnline, isUnstable } = useNetworkStatus();
  const networkRef = useRef({ isOnline, isUnstable });
  const generatingRef = useRef(false);

  useEffect(() => {
    networkRef.current = { isOnline, isUnstable };
  }, [isOnline, isUnstable]);

  const [error, setError] = useState<string | null>(null);
  const [saveMsg, setSaveMsg] = useState<string | null>(null);

  const [result, setResult] = useState<Generated | null>(null);
  const [previewImage, setPreviewImage] = useState<{ src: string; title: string } | null>(null);
  const [showPaywall, setShowPaywall] = useState(false);
  const [redirectingToUpgrade, setRedirectingToUpgrade] = useState(false);
  const [stagedStepIndex, setStagedStepIndex] = useState(0);
  const [stagedLessonId, setStagedLessonId] = useState<string | null>(null);
  const [stagedGenerationMeta, setStagedGenerationMeta] = useState<GenerationMetadata | null>(null);
  const [failedStage, setFailedStage] = useState<FailedStage | null>(null);
  const [retryingStage, setRetryingStage] = useState(false);

  const hasInsufficientCredits = !profileLoading && creditsRemaining < LESSON_PACK_CREDIT_COST;

  useEffect(() => {
    if (
      profileLoading ||
      loading ||
      isGenerating ||
      !result ||
      creditsRemaining > 0 ||
      redirectingToUpgrade
    ) {
      return;
    }

    setRedirectingToUpgrade(true);
    const timer = window.setTimeout(() => {
      router.push("/pricing");
    }, 1800);

    return () => window.clearTimeout(timer);
  }, [creditsRemaining, isGenerating, loading, profileLoading, redirectingToUpgrade, result, router]);

  useEffect(() => {
    const forgeWindow = window as Window & {
      __FORGE_CONTEXT__?: {
        page: string;
        teacherName: string | undefined;
        currentForm: {
          curriculum: string;
          schoolLevel: string;
          subject: string;
          grade: string;
          age: string;
          topic: string;
          numberOfSlides: number;
          durationMins: number;
        };
        currentLesson: Generated | null;
        hasGeneratedResult: boolean;
      };
    };
    forgeWindow.__FORGE_CONTEXT__ = {
      page: "generate",
      teacherName: undefined,
      currentForm: {
        curriculum,
        schoolLevel,
        subject,
        grade,
        age,          // ← NEW
        topic,
        numberOfSlides,
        durationMins,
      },
      currentLesson: result ?? null,
      hasGeneratedResult: !!result,
    };

    return () => {
      const current = forgeWindow.__FORGE_CONTEXT__;
      if (current?.page === "generate") {
        delete forgeWindow.__FORGE_CONTEXT__;
      }
    };
  }, [
    curriculum,
    schoolLevel,
    subject,
    grade,
    age,          // ← NEW
    topic,
    numberOfSlides,
    durationMins,
    result,
  ]);

  function getResponseMessage(json: Record<string, unknown>, fallback: string) {
    return typeof json.message === "string"
      ? json.message
      : typeof json.error === "string"
      ? json.error
      : fallback;
  }

  function getResponseCode(json: Record<string, unknown>) {
    return typeof json.errorCode === "string"
      ? json.errorCode
      : typeof json.error === "string"
      ? json.error
      : "";
  }

  function buildRequestBody(usePersonalCredits = false): GenerationMetadata {
    return {
      curriculum: curriculum.trim(),
      schoolLevel: schoolLevel.trim(),
      subject: subject.trim(),
      grade: grade.trim(),
      age: age.trim(),
      topic: topic.trim(),
      numberOfSlides,
      durationMins,
      examAlignment: "None",
      examBoard: "None",
      usePersonalCredits,
    };
  }

  async function postGenerationStage(
    path: string,
    token: string,
    body: Record<string, unknown>
  ) {
    const res = await fetch(path, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(body),
    });

    const parsedResponse = await readJsonResponse<Record<string, unknown>>(res);
    if (parsedResponse.parseError) {
      throw new Error(getInvalidJsonMessage(res));
    }

    return { res, json: parsedResponse.data ?? {} };
  }

  async function onGenerate() {
    if (generatingRef.current) return;

    if (!isOnline) {
      setError("You're offline. Reconnect to generate your lesson pack.");
      setLoading(false);
      setIsGenerating(false);
      return;
    }

    generatingRef.current = true;
    setLoading(true);
    setIsGenerating(true);
    setSaving(false);
    setError(null);
    setSaveMsg("Lesson generation may take about 30 to 60 seconds. Please do not close this page.");
    setResult(null);
    setFailedStage(null);
    setStagedLessonId(null);
    setStagedGenerationMeta(null);
    setStagedStepIndex(0);

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session?.access_token) {
        throw new Error("Session expired. Please login again.");
      }

      let requestBody = buildRequestBody(false);
      let creditSource: "personal" | "school" | undefined;

      let { res, json } = await postGenerationStage(
        "/api/generate/stage1",
        session.access_token,
        requestBody
      );

      if (!res.ok && res.status === 402 && json?.errorCode === "needs_personal_confirmation") {
        setLoading(false);
        setIsGenerating(false);
        const cost = typeof json.cost === "number" ? json.cost : LESSON_PACK_CREDIT_COST;
        const personalCreditsAvailable =
          typeof json.personalCreditsAvailable === "number"
            ? json.personalCreditsAvailable
            : "available";
        const confirmed = window.confirm(
          `Your school has run out of credits.\n\nUse your personal credits instead?\n\nThis will use ${cost} of your ${personalCreditsAvailable} personal credits.`
        );

        if (!confirmed) {
          throw new Error("Generation cancelled.");
        }

        setLoading(true);
        setIsGenerating(true);
        requestBody = buildRequestBody(true);
        const retryStage1 = await postGenerationStage(
          "/api/generate/stage1",
          session.access_token,
          requestBody
        );
        res = retryStage1.res;
        json = retryStage1.json;
        creditSource = "personal";
      }

      if (!res.ok) {
        const errorCode = getResponseCode(json);

        if (
          res.status === 402 &&
          (errorCode === "out_of_credits" || errorCode === "school_out_of_credits")
        ) {
          setShowPaywall(true);
        }
        throw new Error(getResponseMessage(json, "Generation failed"));
      }

      const lessonId = typeof json.lessonId === "string" ? json.lessonId : "";
      const generationMeta = (json.generationMeta ?? requestBody) as GenerationMetadata;
      const stage1Data = json.data as Generated;
      if (!lessonId) throw new Error("Stage 1 completed but did not return a lessonId.");

      setStagedLessonId(lessonId);
      setStagedGenerationMeta(generationMeta);
      setResult(stage1Data);
      setStagedStepIndex(1);

      setStagedStepIndex(2);
      const stage2 = await postGenerationStage("/api/generate/stage2", session.access_token, {
        lessonId,
        generationMeta,
      });
      if (!stage2.res.ok) {
        setFailedStage(2);
        setSaveMsg("Lesson saved. Some content could not be completed. You can retry from your library.");
        throw new Error(getResponseMessage(stage2.json, "Stage 2 could not be completed."));
      }

      const stage2Data = stage2.json.data as Generated;
      setResult(stage2Data);
      setStagedStepIndex(3);

      const stage3 = await postGenerationStage("/api/generate/stage3", session.access_token, {
        lessonId,
        generationMeta,
      });
      if (!stage3.res.ok) {
        setFailedStage(3);
        setSaveMsg("Lesson saved. Some content could not be completed. You can retry from your library.");
        throw new Error(getResponseMessage(stage3.json, "Stage 3 could not be completed."));
      }

      const generated = await enrichGeneratedLessonImages(
        session.access_token,
        lessonId,
        stage3.json.data as Generated,
        "generate"
      );
      setResult(generated);
      setStagedStepIndex(4);
      setSaving(true);
      setStagedStepIndex(5);
      track("lesson_pack_generated", {
        user_role: "teacher",
        active_role: "teacher",
        credit_source: creditSource,
        credits_cost: LESSON_PACK_CREDIT_COST,
        subject: generated?.meta?.subject ?? subject,
        school_level: generated?.meta?.schoolLevel ?? schoolLevel,
        curriculum: generated?.meta?.curriculum ?? curriculum,
        generation_type: "lesson_pack",
      });
      setSaveMsg("Complete. Auto-saved to Library.");
      setIsGenerating(false);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Something went wrong");
      setIsGenerating(false);
    } finally {
      generatingRef.current = false;
      setLoading(false);
      setSaving(false);
      router.refresh();
    }
  }

  async function retryFailedStage() {
    if (!failedStage || !stagedLessonId || !stagedGenerationMeta || retryingStage) return;

    setRetryingStage(true);
    setError(null);
    setSaveMsg("Retrying the failed stage without deducting credits again.");

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session?.access_token) {
        throw new Error("Session expired. Please login again.");
      }

      setStagedStepIndex(failedStage === 2 ? 2 : 3);
      const retry = await postGenerationStage(
        `/api/generate/stage${failedStage}`,
        session.access_token,
        {
          lessonId: stagedLessonId,
          generationMeta: stagedGenerationMeta,
        }
      );

      if (!retry.res.ok) {
        throw new Error(getResponseMessage(retry.json, `Stage ${failedStage} retry failed.`));
      }

      const nextData = retry.json.data as Generated;
      const enrichedData =
        failedStage === 3
          ? await enrichGeneratedLessonImages(session.access_token, stagedLessonId, nextData, "generate")
          : nextData;
      const nextMeta =
        (enrichedData?.meta?.generationMeta as GenerationMetadata | undefined) ??
        stagedGenerationMeta;
      setResult(enrichedData);
      setStagedGenerationMeta(nextMeta);
      setFailedStage(null);
      setSaveMsg(
        failedStage === 2
          ? "Lesson saved. Quiz and questions completed. Slides are still pending."
          : "Complete. Auto-saved to Library."
      );
      router.refresh();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setRetryingStage(false);
    }
  }

  const meta = result?.meta ?? {};
  const slides = Array.isArray(result?.slides) ? result.slides : [];
  const mcq = result?.quiz?.mcq ?? [];
  const theory = result?.quiz?.theory ?? [];

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
  // ─── Download handler ─────────────────────────────────────────────────────
  async function handleDownloadCompletePack() {
    if (!result || downloadingPack) return;
    setDownloadingPack(true);
    try {
      const html = await renderLessonPackHTML(result, {
        subject,
        topic,
        grade,
        curriculum,
        schoolLevel,
        age,
        numberOfSlides,
      });
      const safeSubject = (meta.subject ?? subject ?? "subject")
        .replace(/[^\w\s-]/g, "").trim().replace(/\s+/g, "_");
      const safeTopic = (meta.topic ?? topic ?? "topic")
        .replace(/[^\w\s-]/g, "").trim().replace(/\s+/g, "_");
      downloadFile(
        `LessonForge_${safeSubject}_${safeTopic}_Complete_Pack.html`,
        html,
        "text/html;charset=utf-8"
      );
    } finally {
      setDownloadingPack(false);
    }
  }

  function handleDownloadImage(src: string, title: string) {
    const a = document.createElement("a");
    a.href = src;
    a.download = `${
      title.replace(/[^\w\s-]/g, "").trim().replace(/\s+/g, "_") || "slide-image"
    }.png`;
    document.body.appendChild(a);
    a.click();
    track("export_png_clicked", {
      user_role: "teacher",
      active_role: "teacher",
      subject: meta.subject ?? subject,
      school_level: meta.schoolLevel ?? schoolLevel,
      curriculum: meta.curriculum ?? curriculum,
      generation_type: "lesson_pack",
    });
    a.remove();
  }

  const lessonTitle = getLessonTitle(result, subject, topic);
  const realLifeItems = getRealLifeItems(result);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-[var(--text-primary)]">Generate Lesson Pack</h1>
        <p className="mt-1 text-sm text-[var(--text-secondary)]">
          Fill the details → generate instantly. Auto-saves to your Library.
        </p>
      </div>

      {hasInsufficientCredits ? (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          <p className="font-semibold">
            You currently have {creditsRemaining} credits on the {planLabel} plan.
          </p>
          <p className="mt-1">
            You need {LESSON_PACK_CREDIT_COST} credits for one lesson pack. Upgrade when ready to
            keep generating.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Link
              href="/pricing"
              className="inline-flex rounded-lg bg-violet-600 px-3 py-2 text-xs font-semibold text-white hover:bg-violet-700"
            >
              View Pricing / Upgrade
            </Link>
            <button
              type="button"
              onClick={() => setShowPaywall(true)}
              className="inline-flex rounded-lg border border-amber-300 bg-[var(--card)] px-3 py-2 text-xs font-semibold text-amber-900 hover:bg-amber-100"
            >
              Learn more
            </button>
          </div>
        </div>
      ) : null}

      <div className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-5 shadow-sm">
        {isGenerating ? (
          <StagedGenerationProgress
            currentStepIndex={stagedStepIndex}
            failedStage={failedStage}
          />
        ) : (
          <>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <Field label="Curriculum / School System">
                <select
                  value={curriculum}
                  onChange={(e) => setCurriculum(e.target.value)}
                  className="w-full rounded-xl border border-[var(--border)] bg-[var(--card)] px-3 py-2 text-sm outline-none focus:border-violet-400"
                >
                  {CURRICULUM_OPTIONS.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              </Field>

              <Field label="School Level">
                <select
                  value={schoolLevel}
                  onChange={(e) => setSchoolLevel(e.target.value)}
                  className="w-full rounded-xl border border-[var(--border)] bg-[var(--card)] px-3 py-2 text-sm outline-none focus:border-violet-400"
                >
                  {SCHOOL_LEVEL_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </Field>

              <Field label="Subject">
                <input
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  placeholder="e.g., Economics"
                  className="w-full rounded-xl border border-[var(--border)] bg-[var(--card)] px-3 py-2 text-sm outline-none focus:border-violet-400"
                />
              </Field>

              <Field label="Class">
                <input
                  value={grade}
                  onChange={(e) => setGrade(e.target.value)}
                  placeholder="e.g., JSS 2, Grade 5, SS 1"
                  className="w-full rounded-xl border border-[var(--border)] bg-[var(--card)] px-3 py-2 text-sm outline-none focus:border-violet-400"
                />
              </Field>

              {/* ── NEW Age field ── */}
              <Field label="Age / Age Group">
                <input
                  value={age}
                  onChange={(e) => setAge(e.target.value)}
                  placeholder="e.g., 10–12, 14, 16+"
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-violet-400"
                />
              </Field>

              <Field label="Topic" full>
                <input
                  value={topic}
                  onChange={(e) => setTopic(e.target.value)}
                  placeholder="e.g., Inflation and Deflation"
                  className="w-full rounded-xl border border-[var(--border)] bg-[var(--card)] px-3 py-2 text-sm outline-none focus:border-violet-400"
                />
              </Field>

              <Field label="Number of Slides">
                <input
                  type="number"
                  min={1}
                  max={20}
                  value={numberOfSlides}
                  onChange={(e) => setNumberOfSlides(Number(e.target.value))}
                  className="w-full rounded-xl border border-[var(--border)] bg-[var(--card)] px-3 py-2 text-sm outline-none focus:border-violet-400"
                />
              </Field>
            </div>

            <div className="mt-4 flex flex-wrap items-center gap-3">
              <button
                onClick={onGenerate}
                disabled={
                  loading ||
                  isGenerating ||
                  hasInsufficientCredits ||
                  !curriculum.trim() ||
                  !schoolLevel.trim() ||
                  !subject.trim() ||
                  !grade.trim() ||
                  !topic.trim()
                }
                type="button"
                className="rounded-xl bg-violet-600 px-5 py-2 text-sm font-semibold text-white shadow-sm hover:bg-violet-700 disabled:opacity-60"
              >
                {loading ? "Generating..." : "Generate Lesson Pack"}
              </button>

              {saving ? (
                <span className="text-sm text-[var(--text-secondary)]">Saving to Library…</span>
              ) : saveMsg ? (
                <span className="text-sm text-emerald-700">{saveMsg}</span>
              ) : null}

              {error ? <span className="text-sm text-red-600">{error}</span> : null}

              {failedStage ? (
                <button
                  type="button"
                  onClick={retryFailedStage}
                  disabled={retryingStage || loading || isGenerating}
                  className="inline-flex items-center gap-2 rounded-lg border border-[var(--border)] bg-[var(--card)] px-3 py-2 text-sm font-semibold text-[var(--text-primary)] hover:bg-slate-100 disabled:opacity-60"
                >
                  {retryingStage ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <RotateCcw className="h-4 w-4" />
                  )}
                  Retry stage {failedStage}
                </button>
              ) : null}
            </div>
          </>
        )}

        <p className="mt-3 text-xs text-[var(--text-tertiary)]">
          🔒 Generation + saving happens securely under your account.
        </p>
      </div>

      {!result ? (
        <div className="rounded-2xl border border-dashed border-[var(--border)] bg-[var(--card)] p-8 text-sm text-[var(--text-tertiary)]">
          Your generated lesson pack will show here.
        </div>
      ) : (
        <div className="space-y-8">
          <section className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-5 shadow-sm">
            <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
              <div>
                <div className="text-xs text-[var(--text-tertiary)]">Topic</div>
                <div className="mt-1 text-xl font-bold text-[var(--text-primary)]">
                  {meta.topic ?? topic}
                </div>
                <div className="mt-1 text-sm text-slate-600">
                  {meta.subject ?? subject} • {meta.grade ?? grade}
                  {age ? ` • Age: ${age}` : ""} •{" "}
                  {meta.curriculum ?? curriculum} • {meta.schoolLevel ?? schoolLevel} •{" "}
                  {meta.numberOfSlides ?? numberOfSlides} slides
                </div>
              </div>

              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={handleDownloadCompletePack}
                  disabled={downloadingPack}
                  className="rounded-xl bg-violet-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-violet-700 disabled:opacity-60 flex items-center gap-2"
                >
                  {downloadingPack ? (
                    <>
                      <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                      </svg>
                      Preparing Pack…
                    </>
                  ) : (
                    <>⬇ Download Complete Pack</>
                  )}
                </button>
              </div>
            </div>

            {/* ── What's inside notice ── */}
            <div className="mt-3 rounded-xl border border-violet-100 bg-violet-50 px-4 py-3 text-xs text-violet-800">
              <strong>Complete Pack includes:</strong> Lesson Plan · Lesson Notes · All Slides with Images · Video Links · Multiple Choice Questions · Theory Questions · References — in one offline-ready HTML file.
            </div>
          </section>

          {result?.lessonPlan ? (
            <section className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-5 shadow-sm space-y-5">
              <h3 className="text-xl font-extrabold text-[var(--text-primary)] tracking-tight">
                Lesson Plan
              </h3>

              <div>
                <p className="text-sm font-semibold text-[var(--text-primary)]">Title</p>
                <p className="mt-1 text-sm text-[var(--text-secondary)]">{lessonTitle}</p>
              </div>

              {!!asStringArray(result.lessonPlan.performanceObjectives).length && (
                <div>
                  <p className="text-sm font-semibold text-[var(--text-primary)]">
                    Performance Objectives
                  </p>
                  <ul className="mt-2 list-disc pl-6 space-y-2 text-sm text-[var(--text-secondary)]">
                    {asStringArray(result.lessonPlan.performanceObjectives).map((item, i) => (
                      <li key={i}>{item}</li>
                    ))}
                  </ul>
                </div>
              )}

              {!!asStringArray(result.lessonPlan.successCriteria).length && (
                <div>
                  <p className="text-sm font-semibold text-[var(--text-primary)]">Success Criteria</p>
                  <ul className="mt-2 list-disc pl-6 space-y-2 text-sm text-[var(--text-secondary)]">
                    {asStringArray(result.lessonPlan.successCriteria).map((item, i) => (
                      <li key={i}>{item}</li>
                    ))}
                  </ul>
                </div>
              )}

              {!!asStringArray(result.lessonPlan.instructionalMaterials).length && (
                <div>
                  <p className="text-sm font-semibold text-[var(--text-primary)]">
                    Instructional Materials
                  </p>
                  <ul className="mt-2 list-disc pl-6 space-y-2 text-sm text-[var(--text-secondary)]">
                    {asStringArray(result.lessonPlan.instructionalMaterials).map((item, i) => (
                      <li key={i}>{item}</li>
                    ))}
                  </ul>
                </div>
              )}

              {!!asStringArray(result.lessonPlan.lifeNatureActivities).length && (
                <div>
                  <p className="text-sm font-semibold text-[var(--text-primary)]">
                    Life / Nature Activities
                  </p>
                  <ul className="mt-2 list-disc pl-6 space-y-2 text-sm text-[var(--text-secondary)]">
                    {asStringArray(result.lessonPlan.lifeNatureActivities).map((item, i) => (
                      <li key={i}>{item}</li>
                    ))}
                  </ul>
                </div>
              )}

              {!!asStringArray(result.lessonPlan.crossCurricularActivities).length && (
                <div>
                  <p className="text-sm font-semibold text-[var(--text-primary)]">
                    Cross-Curricular Activities
                  </p>
                  <ul className="mt-2 list-disc pl-6 space-y-2 text-sm text-[var(--text-secondary)]">
                    {asStringArray(result.lessonPlan.crossCurricularActivities).map((item, i) => (
                      <li key={i}>{item}</li>
                    ))}
                  </ul>
                </div>
              )}

              {result.lessonPlan.previousKnowledge ? (
                <div>
                  <p className="text-sm font-semibold text-[var(--text-primary)]">Previous Knowledge</p>
                  <p className="mt-1 text-sm text-[var(--text-secondary)] whitespace-pre-wrap">
                    {result.lessonPlan.previousKnowledge}
                  </p>
                </div>
              ) : null}

              {result.lessonPlan.introduction ? (
                <div>
                  <p className="text-sm font-semibold text-[var(--text-primary)]">Introduction</p>
                  <p className="mt-1 text-sm text-[var(--text-secondary)] whitespace-pre-wrap">
                    {result.lessonPlan.introduction}
                  </p>
                </div>
              ) : null}

              {!!Array.isArray(result.lessonPlan.keyVocabulary) &&
                result.lessonPlan.keyVocabulary.length > 0 && (
                  <div>
                    <p className="text-sm font-semibold text-[var(--text-primary)]">Key Vocabulary</p>
                    <ul className="mt-2 list-disc pl-6 space-y-2 text-sm text-[var(--text-secondary)]">
                      {result.lessonPlan.keyVocabulary.map((item, i) => (
                        <li key={i}>
                          <span className="font-semibold">{item.word}</span>
                          {item.simpleMeaning ? ` — ${item.simpleMeaning}` : ""}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

              {!!asStringArray(result.lessonPlan.commonMisconceptions).length && (
                <div>
                  <p className="text-sm font-semibold text-[var(--text-primary)]">
                    Common Misconceptions
                  </p>
                  <ul className="mt-2 list-disc pl-6 space-y-2 text-sm text-[var(--text-secondary)]">
                    {asStringArray(result.lessonPlan.commonMisconceptions).map((item, i) => (
                      <li key={i}>{item}</li>
                    ))}
                  </ul>
                </div>
              )}

              {!!result.lessonPlan.steps?.length && (
                <div className="space-y-4">
                  <p className="text-sm font-semibold text-[var(--text-primary)]">
                    Lesson Delivery Steps
                  </p>
                  {result.lessonPlan.steps.map((step, i) => {
                    const stepNumber = step.stepNumber ?? step.step ?? i + 1;
                    const stepTitle = step.stepTitle ?? step.title ?? `Step ${i + 1}`;

                    return (
                      <div
                        key={i}
                        className="rounded-xl border border-[var(--border)] bg-[var(--card-alt)] p-4 space-y-2"
                      >
                        <p className="font-semibold text-[var(--text-primary)]">
                          Step {stepNumber}: {stepTitle}
                        </p>

                        {step.timeMinutes ? (
                          <p className="text-sm text-[var(--text-secondary)]">
                            <span className="font-semibold">Time:</span> {step.timeMinutes} mins
                          </p>
                        ) : null}

                        {step.teacherActivity ? (
                          <p className="text-sm text-[var(--text-secondary)]">
                            <span className="font-semibold">Teacher Activity:</span>{" "}
                            {step.teacherActivity}
                          </p>
                        ) : null}

                        {step.learnerActivity ? (
                          <p className="text-sm text-[var(--text-secondary)]">
                            <span className="font-semibold">Learner Activity:</span>{" "}
                            {step.learnerActivity}
                          </p>
                        ) : null}

                        {step.guidedQuestions?.length ? (
                          <div className="text-sm text-[var(--text-secondary)]">
                            <div className="font-semibold">Guided Questions:</div>
                            <ul className="mt-1 list-disc pl-6 space-y-1">
                              {step.guidedQuestions.map((question, j) => (
                                <li key={j}>{question}</li>
                              ))}
                            </ul>
                          </div>
                        ) : null}

                        {step.teachingMethod ? (
                          <p className="text-sm text-[var(--text-secondary)]">
                            <span className="font-semibold">Teaching Method:</span>{" "}
                            {step.teachingMethod}
                          </p>
                        ) : null}

                        {step.assessmentCheck ? (
                          <p className="text-sm text-[var(--text-secondary)]">
                            <span className="font-semibold">Assessment Check:</span>{" "}
                            {step.assessmentCheck}
                          </p>
                        ) : null}

                        {step.concretisedLearningPoint ? (
                          <p className="text-sm text-[var(--text-secondary)]">
                            <span className="font-semibold">Learning Point:</span>{" "}
                            {step.concretisedLearningPoint}
                          </p>
                        ) : null}
                      </div>
                    );
                  })}
                </div>
              )}

              {result.lessonPlan.differentiation ? (
                <div className="space-y-2">
                  <p className="text-sm font-semibold text-[var(--text-primary)]">Differentiation</p>

                  {result.lessonPlan.differentiation.supportForStrugglingLearners ? (
                    <p className="text-sm text-[var(--text-secondary)]">
                      <span className="font-semibold">Support for Struggling Learners:</span>{" "}
                      {result.lessonPlan.differentiation.supportForStrugglingLearners}
                    </p>
                  ) : null}

                  {result.lessonPlan.differentiation.supportForAverageLearners ? (
                    <p className="text-sm text-[var(--text-secondary)]">
                      <span className="font-semibold">Support for Average Learners:</span>{" "}
                      {result.lessonPlan.differentiation.supportForAverageLearners}
                    </p>
                  ) : null}

                  {result.lessonPlan.differentiation.challengeForAdvancedLearners ? (
                    <p className="text-sm text-[var(--text-secondary)]">
                      <span className="font-semibold">Challenge for Advanced Learners:</span>{" "}
                      {result.lessonPlan.differentiation.challengeForAdvancedLearners}
                    </p>
                  ) : null}
                </div>
              ) : null}

              {!!asStringArray(result.lessonPlan.boardSummary).length && (
                <div>
                  <p className="text-sm font-semibold text-[var(--text-primary)]">Board Summary</p>
                  <ul className="mt-2 list-disc pl-6 space-y-2 text-sm text-[var(--text-secondary)]">
                    {asStringArray(result.lessonPlan.boardSummary).map((item, i) => (
                      <li key={i}>{item}</li>
                    ))}
                  </ul>
                </div>
              )}

              {!!result.lessonPlan.evaluation?.length && (
                <div>
                  <p className="text-sm font-semibold text-[var(--text-primary)]">Evaluation</p>
                  <ul className="mt-2 list-disc pl-6 space-y-3 text-sm text-[var(--text-secondary)]">
                    {result.lessonPlan.evaluation.map((item, i) => (
                      <li key={i}>
                        {typeof item === "string" ? (
                          item
                        ) : (
                          <div className="space-y-1">
                            <div>{item.question}</div>
                            {item.markingGuide ? (
                              <div className="text-xs text-[var(--text-tertiary)]">
                                <span className="font-semibold">Marking Guide:</span>{" "}
                                {item.markingGuide}
                              </div>
                            ) : null}
                          </div>
                        )}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {!!asStringArray(result.lessonPlan.exitTicket).length && (
                <div>
                  <p className="text-sm font-semibold text-[var(--text-primary)]">Exit Ticket</p>
                  <ul className="mt-2 list-disc pl-6 space-y-2 text-sm text-[var(--text-secondary)]">
                    {asStringArray(result.lessonPlan.exitTicket).map((item, i) => (
                      <li key={i}>{item}</li>
                    ))}
                  </ul>
                </div>
              )}

              {!!asStringArray(result.lessonPlan.assignment).length && (
                <div>
                  <p className="text-sm font-semibold text-[var(--text-primary)]">Assignment</p>
                  <ul className="mt-2 list-disc pl-6 space-y-2 text-sm text-[var(--text-secondary)]">
                    {asStringArray(result.lessonPlan.assignment).map((item, i) => (
                      <li key={i}>{item}</li>
                    ))}
                  </ul>
                </div>
              )}

              {!!realLifeItems.length && (
                <div>
                  <p className="text-sm font-semibold text-[var(--text-primary)]">
                    Real-life Applications
                  </p>
                  <ul className="mt-2 list-disc pl-6 space-y-2 text-sm text-[var(--text-secondary)]">
                    {realLifeItems.map((item, i) => (
                      <li key={i}>{item}</li>
                    ))}
                  </ul>
                </div>
              )}
            </section>
          ) : null}

          <section className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-5 shadow-sm space-y-4">
            <h3 className="text-xl font-extrabold text-[var(--text-primary)] tracking-tight">
              Lesson Notes
            </h3>
            {result.lessonNotes ? (
              typeof result.lessonNotes === "string" ? (
                <p className="whitespace-pre-wrap text-sm text-[var(--text-secondary)] leading-relaxed">
                  {result.lessonNotes}
                </p>
              ) : (
                <div className="space-y-4">
                  {result.lessonNotes.introduction && (
                    <div>
                      <p className="text-sm font-semibold text-[var(--text-primary)]">Introduction</p>
                      <p className="mt-1 text-sm text-[var(--text-secondary)] leading-relaxed">
                        {result.lessonNotes.introduction}
                      </p>
                    </div>
                  )}
                  {result.lessonNotes.keyConcepts?.length ? (
                    <div>
                      <p className="text-sm font-semibold text-[var(--text-primary)]">Key Concepts</p>
                      <div className="mt-2 space-y-3">
                        {result.lessonNotes.keyConcepts.map((concept, i) => (
                          <div key={i} className="border-l-2 border-violet-200 pl-3">
                            <p className="text-sm font-medium text-[var(--text-primary)]">
                              {concept.subheading || `Concept ${i + 1}`}
                            </p>
                            {concept.content && (
                              <p className="mt-1 text-sm text-[var(--text-secondary)]">{concept.content}</p>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : null}
                  {result.lessonNotes.workedExamples?.length ? (
                    <div>
                      <p className="text-sm font-semibold text-[var(--text-primary)]">Worked Examples</p>
                      <div className="mt-2 space-y-4">
                        {result.lessonNotes.workedExamples.map((example, i) => (
                          <div key={i} className="rounded-lg border border-[var(--border)] p-3">
                            <p className="text-sm font-medium text-[var(--text-primary)]">
                              {example.title || `Example ${i + 1}`}
                            </p>
                            {example.problem && (
                              <p className="mt-1 text-sm text-[var(--text-secondary)]">
                                <span className="font-medium">Problem:</span> {example.problem}
                              </p>
                            )}
                            {example.steps?.length ? (
                              <div className="mt-2">
                                <p className="text-sm font-medium text-[var(--text-primary)]">Steps:</p>
                                <ol className="mt-1 list-decimal pl-5 space-y-1 text-sm text-[var(--text-secondary)]">
                                  {example.steps.map((step, j) => (
                                    <li key={j}>{step}</li>
                                  ))}
                                </ol>
                              </div>
                            ) : null}
                            {example.finalAnswer && (
                              <p className="mt-2 text-sm text-[var(--text-secondary)]">
                                <span className="font-medium">Final Answer:</span> {example.finalAnswer}
                              </p>
                            )}
                            {example.explanation && (
                              <p className="mt-2 text-sm text-[var(--text-secondary)]">
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
                      <p className="text-sm font-semibold text-[var(--text-primary)]">Summary Points</p>
                      <ul className="mt-2 list-disc pl-5 space-y-1 text-sm text-[var(--text-secondary)]">
                        {result.lessonNotes.summaryPoints.map((point, i) => (
                          <li key={i}>{point}</li>
                        ))}
                      </ul>
                    </div>
                  ) : null}
                  {result.lessonNotes.keyVocabulary?.length ? (
                    <div>
                      <p className="text-sm font-semibold text-[var(--text-primary)]">Key Vocabulary</p>
                      <div className="mt-2 space-y-2">
                        {result.lessonNotes.keyVocabulary.map((item, i) => (
                          <div key={i} className="flex gap-2 text-sm">
                            <span className="font-medium text-[var(--text-primary)] min-w-0 flex-1">
                              {item.word}
                            </span>
                            <span className="text-[var(--text-secondary)]">:</span>
                            <span className="text-[var(--text-secondary)] flex-1">{item.meaning}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : null}

                  {result.lessonNotes.realLifeApplications?.length ? (
                    <div>
                      <p className="text-sm font-semibold text-[var(--text-primary)]">
                        Real-Life Applications
                      </p>
                      <ul className="mt-2 list-disc pl-6 space-y-2 text-sm text-[var(--text-secondary)]">
                        {result.lessonNotes.realLifeApplications.map((item, i) => (
                          <li key={i}>{item}</li>
                        ))}
                      </ul>
                    </div>
                  ) : null}

                  {result.lessonNotes.exitTicket?.length ? (
                    <div>
                      <p className="text-sm font-semibold text-[var(--text-primary)]">Exit Ticket</p>
                      <ul className="mt-2 list-disc pl-6 space-y-2 text-sm text-[var(--text-secondary)]">
                        {result.lessonNotes.exitTicket.map((item, i) => (
                          <li key={i}>{item}</li>
                        ))}
                      </ul>
                    </div>
                  ) : null}
                </div>
              )
            ) : (
              <p className="text-sm text-[var(--text-tertiary)]">No lesson notes generated.</p>
            )}
          </section>

          {Array.isArray(result.references) && result.references.length ? (
            <section className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-5 shadow-sm space-y-2">
              <h3 className="text-xl font-extrabold text-[var(--text-primary)] tracking-tight">
                References
              </h3>
              <ul className="list-disc pl-6 space-y-2 text-sm text-[var(--text-secondary)]">
                {result.references.map((ref, i) => (
                  <li key={i}>{ref}</li>
                ))}
              </ul>
            </section>
          ) : null}

          <section className="space-y-4">
            <h3 className="text-xl font-extrabold text-[var(--text-primary)] tracking-tight">
              Slides
            </h3>

            {slides.length ? (
              <div className="grid gap-6">
                {slides.map((s, i) => {
                  const slideNumber = s?.slideNumber ?? i + 1;
                  const slideType = s?.slideType ? s.slideType.replace(/_/g, " ") : "";
                  const title = s?.title || "Untitled slide";
                  const bullets = Array.isArray(s?.bullets) ? s.bullets : [];
                  const videoQuery = s?.videoQuery || title || `${subject} ${topic}`.trim();
                  const activity =
                    s?.interactivePrompt || "No interactive activity provided.";
                  const teacherPrompt =
                    s?.teacherPrompt || "No teacher prompt provided.";
                  const studentTask =
                    s?.studentTask || "No student task provided.";
                  const imgSrc = getSlideImageSrc(s);
                  const visualSuggestion = s?.visual_suggestion || s?.image_query || s?.imageQuery || "";

                  return (
                    <div
                      key={i}
                      className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-5 shadow-sm space-y-4"
                    >
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <div className="text-lg font-bold text-[var(--text-primary)]">
                            {slideNumber}. {title}
                          </div>
                          {slideType ? (
                            <div className="text-xs uppercase text-[var(--text-tertiary)]">
                              {slideType}
                            </div>
                          ) : null}
                        </div>
                        <span className="text-[11px] font-semibold px-2 py-1 rounded-full border bg-[var(--card-alt)] text-[var(--text-secondary)]">
                          Slide {slideNumber}
                        </span>
                      </div>

                      {imgSrc ? (
                        <>
                          <div className="rounded-xl overflow-hidden border bg-slate-100">
                            <button
                              type="button"
                              onClick={() => setPreviewImage({ src: imgSrc, title })}
                              className="block w-full text-left"
                            >
                              <img
                                src={imgSrc}
                                alt={s?.image_alt || title}
                                className="w-full h-52 object-cover transition hover:scale-[1.01]"
                              />
                            </button>
                          </div>

                          <div className="flex flex-wrap gap-3 text-sm">
                            <button
                              type="button"
                              onClick={() => setPreviewImage({ src: imgSrc, title })}
                              className="rounded-lg border border-[var(--border)] bg-[var(--card)] px-3 py-2 font-semibold text-[var(--text-primary)] hover:bg-slate-100"
                            >
                              View full image
                            </button>

                            <button
                              type="button"
                              onClick={() => handleDownloadImage(imgSrc, title)}
                              className="rounded-lg border border-[var(--border)] bg-[var(--card)] px-3 py-2 font-semibold text-[var(--text-primary)] hover:bg-slate-100"
                            >
                              Download image
                            </button>
                          </div>
                        </>
                      ) : (
                        <div className="rounded-xl border bg-slate-50 p-5 text-sm text-[var(--text-secondary)]">
                          <div className="text-xs font-bold uppercase tracking-[0.18em] text-indigo-700">
                            Visual Guide
                          </div>
                          <p className="mt-2 font-medium text-[var(--text-primary)]">
                            {visualSuggestion || "No image available for this slide."}
                          </p>
                        </div>
                      )}

                      {bullets.length ? (
                        <ul className="list-disc pl-6 space-y-2 text-[var(--text-primary)] font-medium">
                          {bullets.map((b, j) => (
                            <li key={j}>{b}</li>
                          ))}
                        </ul>
                      ) : (
                        <p className="text-sm text-[var(--text-secondary)]">No bullet points.</p>
                      )}

                      <div className="space-y-3 rounded-xl border border-[var(--border)] bg-[var(--card-alt)] p-3 text-sm text-[var(--text-primary)]">
                        <div>
                          <span className="font-semibold">Teacher Prompt:</span> {teacherPrompt}
                        </div>
                        <div>
                          <span className="font-semibold">Student Task:</span> {studentTask}
                        </div>
                      </div>

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

                      <div className="rounded-xl border bg-yellow-50 p-3 text-sm text-[var(--text-primary)]">
                        <span className="font-bold">👩🏽‍🏫 Classroom Activity:</span>{" "}
                        {activity}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-sm text-[var(--text-secondary)]">No slides generated yet.</p>
            )}
          </section>

          {previewImage ? (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
              <div className="w-full max-w-5xl rounded-2xl bg-[var(--card)] p-4 shadow-2xl">
                <div className="mb-4 flex items-center justify-between gap-3">
                  <div className="text-base font-bold text-[var(--text-primary)]">
                    {previewImage.title}
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() =>
                        handleDownloadImage(previewImage.src, previewImage.title)
                      }
                      className="rounded-lg border border-[var(--border)] bg-[var(--card)] px-3 py-2 text-sm font-semibold text-[var(--text-primary)] hover:bg-slate-100"
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

                <div className="max-h-[75vh] overflow-auto rounded-xl border bg-[var(--card-alt)] p-2">
                  <img
                    src={previewImage.src}
                    alt={previewImage.title}
                    className="mx-auto h-auto max-w-full rounded-lg"
                  />
                </div>
              </div>
            </div>
          ) : null}

          {mcq.length ? (
            <section className="space-y-4">
              <h3 className="text-2xl font-bold text-[var(--text-primary)]">
                📝 Multiple Choice Questions
              </h3>

              <div className="space-y-6">
                {mcq.map((q, i) => {
                  const options = Array.isArray(q?.options) ? q.options : [];
                  const shuffledOptions = shuffleArray(options);

                  return (
                    <div
                      key={i}
                      className="rounded-xl border border-[var(--border)] p-5 bg-[var(--card)] shadow-sm"
                    >
                      <p className="font-semibold text-lg mb-3 text-[var(--text-primary)]">
                        {i + 1}. {q?.q || "Question text missing"}
                      </p>
                      <ul className="space-y-2">
                        {shuffledOptions.map((opt, j) => (
                          <li key={j} className="flex items-start gap-3 text-[var(--text-primary)]">
                            <span className="font-bold text-indigo-600 min-w-[24px]">
                              {String.fromCharCode(65 + j)}.
                            </span>
                            <span>{opt}</span>
                          </li>
                        ))}
                      </ul>

                      {q?.explanation ? (
                        <div className="mt-3 p-3 bg-[var(--card-alt)] rounded-lg border border-[var(--border)]">
                          <p className="text-xs font-semibold text-[var(--text-secondary)] mb-1">
                            Explanation:
                          </p>
                          <p className="text-sm text-[var(--text-secondary)]">{q.explanation}</p>
                        </div>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            </section>
          ) : null}

          {theory.length ? (
            <section className="space-y-4">
              <h3 className="text-2xl font-bold text-[var(--text-primary)]">✍️ Theory Questions</h3>

              <div className="space-y-4">
                {theory.map((q, i) => (
                  <div
                    key={i}
                    className="rounded-xl border border-[var(--border)] p-5 bg-[var(--card)] shadow-sm"
                  >
                    <p className="font-semibold text-lg mb-2 text-[var(--text-primary)]">
                      {i + 1}. {q?.question || q?.q || "Question text missing"}
                    </p>

                    {q?.markingGuide ? (
                      <div className="mt-3 p-3 bg-[var(--card-alt)] rounded-lg border border-[var(--border)]">
                        <p className="text-xs font-semibold text-[var(--text-secondary)] mb-1">
                          Marking Guide:
                        </p>
                        <p className="text-sm text-[var(--text-secondary)]">{q.markingGuide}</p>
                      </div>
                    ) : null}
                  </div>
                ))}
              </div>
            </section>
          ) : null}

          {Array.isArray(result.liveApplications) && result.liveApplications.length ? (
            <section className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-5 shadow-sm space-y-2">
              <h3 className="text-xl font-extrabold text-[var(--text-primary)] tracking-tight">
                Live / Real-World Applications
              </h3>
              <ul className="list-disc pl-6 space-y-2 text-sm text-[var(--text-secondary)]">
                {result.liveApplications.map((item, i) => (
                  <li key={i}>{item}</li>
                ))}
              </ul>
            </section>
          ) : null}
        </div>
      )}
      <TeacherPaywallModal
        open={showPaywall}
        onClose={() => setShowPaywall(false)}
        remainingCredits={creditsRemaining}
      />
    </div>
  );
}

function Field({
  label,
  children,
  full,
}: {
  label: string;
  children: React.ReactNode;
  full?: boolean;
}) {
  return (
    <div className={full ? "md:col-span-2" : ""}>
      <div className="mb-1 text-xs font-medium text-[var(--text-secondary)]">{label}</div>
      {children}
    </div>
  );
}

function StagedGenerationProgress({
  currentStepIndex,
  failedStage,
}: {
  currentStepIndex: number;
  failedStage: FailedStage | null;
}) {
  return (
    <div className="space-y-4">
      <div>
        <p className="text-sm font-semibold text-[var(--text-primary)]">
          Lesson generation may take about 30 to 60 seconds. Please do not close this page.
        </p>
      </div>

      <div className="space-y-3">
        {STAGED_PROGRESS_STEPS.map((label, index) => {
          const stepNumber = index + 1;
          const complete = currentStepIndex > index;
          const active = currentStepIndex === index;
          const failed =
            (failedStage === 2 && index === 2) ||
            (failedStage === 3 && index === 3);

          return (
            <div
              key={label}
              className="flex items-center gap-3 rounded-lg border border-[var(--border)] bg-[var(--card-alt)] px-3 py-2"
            >
              {failed ? (
                <AlertCircle className="h-4 w-4 text-red-600" />
              ) : complete ? (
                <CheckCircle2 className="h-4 w-4 text-emerald-600" />
              ) : active ? (
                <Loader2 className="h-4 w-4 animate-spin text-violet-600" />
              ) : (
                <Circle className="h-4 w-4 text-[var(--text-tertiary)]" />
              )}
              <span className="text-sm font-medium text-[var(--text-primary)]">
                [{stepNumber}/5] {complete && stepNumber === 5 ? "Complete" : label}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
