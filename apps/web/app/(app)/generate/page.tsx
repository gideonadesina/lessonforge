"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createBrowserSupabase } from "@/lib/supabase/browser";
import { useProfile } from "@/lib/useProfile";
import TeacherPaywallModal from "@/components/billing/TeacherPaywallModal";
import { LESSON_PACK_CREDIT_COST } from "@/lib/billing/pricing";

type VocabularyItem = {
  word?: string;
  simpleMeaning?: string;
};

type LessonStep = {
  step?: number;
  title?: string;
  stepNumber?: number;
  stepTitle?: string;
  timeMinutes?: number;
  teacherActivity?: string;
  learnerActivity?: string;
  teachingMethod?: string;
  assessmentCheck?: string;
  concretisedLearningPoint?: string;
};

type EvaluationItem =
  | string
  | {
      question?: string;
      markingGuide?: string;
    };

type TheoryItem = {
  q?: string;
  question?: string;
  markingGuide?: string;
};

type Generated = {
  lessonPlan?: {
    title?: string;
    lessonTitle?: string;
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
    evaluation?: EvaluationItem[];
    exitTicket?: string[];
    assignment?: string[];
    boardSummary?: string[];
    realLifeConnection?: string[];
    realLifeApplications?: string[];
  };
  meta?: {
    subject?: string;
    topic?: string;
    grade?: string;
    curriculum?: string;
    schoolLevel?: string;
    numberOfSlides?: number;
    durationMins?: number;
  };
  objectives?: string[];
  lessonNotes?: string;
  references?: string[];
  slides?: Array<{
    title?: string;
    bullets?: string[];
    image?: string;
    imageQuery?: string;
    videoQuery?: string;
    interactivePrompt?: string;
  }>;
  quiz?: {
    mcq?: Array<{ q?: string; options?: string[]; answerIndex?: number }>;
    theory?: TheoryItem[];
  };
  liveApplications?: string[];
};

const FALLBACK_IMG =
  "https://images.unsplash.com/photo-1524995997946-a1c2e315a42f?w=1200";

const CURRICULUM_OPTIONS = [
  "Nigerian Curriculum",
  "British Curriculum",
  "American Curriculum",
  "British-Nigerian Blended Curriculum",
  "American-Nigerian Blended Curriculum",
  "Turkish Curriculum",
];

const SCHOOL_LEVEL_OPTIONS = ["EYFS / Nursery", "Primary", "Secondary"];

function youtubeSearchUrl(query: string) {
  const q = (query || "").trim();
  return `https://www.youtube.com/results?search_query=${encodeURIComponent(q)}`;
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
  const [topic, setTopic] = useState("");
  const [numberOfSlides, setNumberOfSlides] = useState(8);

  const [durationMins] = useState(40);

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loadingStep, setLoadingStep] = useState<string | null>(null);

  const [error, setError] = useState<string | null>(null);
  const [saveMsg, setSaveMsg] = useState<string | null>(null);

  const [result, setResult] = useState<Generated | null>(null);
  const [previewImage, setPreviewImage] = useState<{ src: string; title: string } | null>(null);
  const [showPaywall, setShowPaywall] = useState(false);

  const hasInsufficientCredits = !profileLoading && creditsRemaining < LESSON_PACK_CREDIT_COST;

  useEffect(() => {
    (window as any).__FORGE_CONTEXT__ = {
      page: "generate",
      teacherName: undefined,
      currentForm: {
        curriculum,
        schoolLevel,
        subject,
        grade,
        topic,
        numberOfSlides,
        durationMins,
      },
      currentLesson: result ?? null,
      hasGeneratedResult: !!result,
    };

    return () => {
      const current = (window as any).__FORGE_CONTEXT__;
      if (current?.page === "generate") {
        delete (window as any).__FORGE_CONTEXT__;
      }
    };
  }, [
    curriculum,
    schoolLevel,
    subject,
    grade,
    topic,
    numberOfSlides,
    durationMins,
    result,
  ]);

  async function onGenerate() {
    if (hasInsufficientCredits) {
      setShowPaywall(true);
      setError(
        `You need at least ${LESSON_PACK_CREDIT_COST} credits to generate one lesson pack.`
      );
      return;
    }

    setLoading(true);
    setSaving(false);
    setError(null);
    setSaveMsg(null);
    setResult(null);

    // Simulate progress through steps
    const steps = [
      "Preparing your lesson...",
      "Generating lesson plan...",
      "Generating lesson notes...",
      "Building slides...",
      "Preparing images...",
      "Saving to library...",
      "Almost done...",
    ];
    
    setLoadingStep(steps[0]);
    let stepIndex = 0;
    const stepInterval = setInterval(() => {
      stepIndex++;
      if (stepIndex < steps.length) {
        setLoadingStep(steps[stepIndex]);
      }
    }, 2000);

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session?.access_token) {
        throw new Error("Session expired. Please login again.");
      }

      const res = await fetch("/api/generate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          curriculum: curriculum.trim(),
          schoolLevel: schoolLevel.trim(),
          subject: subject.trim(),
          grade: grade.trim(),
          topic: topic.trim(),
          numberOfSlides,
          durationMins,
        }),
      });

      const json = await res.json();

      if (!res.ok) {
        if (res.status === 402) {
          setShowPaywall(true);
        }
        throw new Error(json?.error || json?.message || "Generation failed");
      }

      const generated = json.data as Generated;
      setResult(generated);
      console.log("GENERATED DATA:", generated);

      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) throw new Error("User not authenticated");

      const { error: insertError } = await supabase.from("lessons").insert({
        user_id: user.id,
        subject: generated?.meta?.subject ?? subject,
        topic: generated?.meta?.topic ?? topic,
        grade: generated?.meta?.grade ?? grade,
        curriculum: generated?.meta?.curriculum ?? curriculum,
        result_json: {
          ...generated,
          meta: {
            ...(generated?.meta ?? {}),
            subject: generated?.meta?.subject ?? subject,
            topic: generated?.meta?.topic ?? topic,
            grade: generated?.meta?.grade ?? grade,
            curriculum: generated?.meta?.curriculum ?? curriculum,
            schoolLevel: generated?.meta?.schoolLevel ?? schoolLevel,
            numberOfSlides: generated?.meta?.numberOfSlides ?? numberOfSlides,
            durationMins: generated?.meta?.durationMins ?? durationMins,
          },
        },
      });

      if (insertError) {
        console.error("Save failed:", insertError.message);
        throw insertError;
      }

      setSaveMsg("✅ Auto-saved to Library");
    } catch (e: any) {
      setError(e?.message || "Something went wrong");
    } finally {
      setLoading(false);
      setSaving(false);
      setLoadingStep(null);
      clearInterval(stepInterval);
      router.refresh();
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

  function buildLessonStructureText() {
    if (!result) return "";

    const meta = result.meta ?? {};
    const lessonPlan = result.lessonPlan ?? {};
    const slides = Array.isArray(result.slides) ? result.slides : [];
    const mcq = result.quiz?.mcq ?? [];
    const theory = result.quiz?.theory ?? [];
    const liveApps = result.liveApplications ?? [];
    const realLifeItems = getRealLifeItems(result);
    const lessonTitle = getLessonTitle(result, subject, topic);

    const lines: string[] = [];

    lines.push("LESSONFORGE LESSON / CURRICULUM STRUCTURE REPORT");
    lines.push("=".repeat(55));
    lines.push("");
    lines.push(`Subject: ${meta.subject ?? subject}`);
    lines.push(`Topic: ${meta.topic ?? topic}`);
    lines.push(`Class: ${meta.grade ?? grade}`);
    lines.push(`Curriculum: ${meta.curriculum ?? curriculum}`);
    lines.push(`School Level: ${meta.schoolLevel ?? schoolLevel}`);
    lines.push(`Number of Slides: ${meta.numberOfSlides ?? numberOfSlides}`);
    lines.push(`Duration: ${meta.durationMins ?? 40} minutes`);
    lines.push("");

    lines.push("LESSON PLAN TITLE");
    lines.push("-".repeat(20));
    lines.push(lessonTitle);
    lines.push("");

    if (asStringArray(lessonPlan.performanceObjectives).length) {
      lines.push("PERFORMANCE OBJECTIVES");
      lines.push("-".repeat(24));
      asStringArray(lessonPlan.performanceObjectives).forEach((item, i) => {
        lines.push(`${i + 1}. ${item}`);
      });
      lines.push("");
    }

    if (asStringArray(lessonPlan.successCriteria).length) {
      lines.push("SUCCESS CRITERIA");
      lines.push("-".repeat(16));
      asStringArray(lessonPlan.successCriteria).forEach((item, i) => {
        lines.push(`${i + 1}. ${item}`);
      });
      lines.push("");
    }

    if (asStringArray(lessonPlan.instructionalMaterials).length) {
      lines.push("INSTRUCTIONAL MATERIALS");
      lines.push("-".repeat(23));
      asStringArray(lessonPlan.instructionalMaterials).forEach((item, i) => {
        lines.push(`${i + 1}. ${item}`);
      });
      lines.push("");
    }

    if (asStringArray(lessonPlan.lifeNatureActivities).length) {
      lines.push("LIFE / NATURE ACTIVITIES");
      lines.push("-".repeat(24));
      asStringArray(lessonPlan.lifeNatureActivities).forEach((item, i) => {
        lines.push(`${i + 1}. ${item}`);
      });
      lines.push("");
    }

    if (asStringArray(lessonPlan.crossCurricularActivities).length) {
      lines.push("CROSS-CURRICULAR ACTIVITIES");
      lines.push("-".repeat(27));
      asStringArray(lessonPlan.crossCurricularActivities).forEach((item, i) => {
        lines.push(`${i + 1}. ${item}`);
      });
      lines.push("");
    }

    if (lessonPlan.previousKnowledge) {
      lines.push("PREVIOUS KNOWLEDGE");
      lines.push("-".repeat(18));
      lines.push(String(lessonPlan.previousKnowledge));
      lines.push("");
    }

    if (lessonPlan.introduction) {
      lines.push("INTRODUCTION");
      lines.push("-".repeat(12));
      lines.push(String(lessonPlan.introduction));
      lines.push("");
    }

    if (Array.isArray(lessonPlan.steps) && lessonPlan.steps.length) {
      lines.push("LESSON DELIVERY STEPS");
      lines.push("-".repeat(21));
      lessonPlan.steps.forEach((step, i) => {
        const stepNumber = step?.stepNumber ?? step?.step ?? i + 1;
        const stepTitle = step?.stepTitle ?? step?.title ?? "Lesson Step";
        lines.push(`Step ${stepNumber}: ${stepTitle}`);
        if (step?.timeMinutes) lines.push(`Time: ${step.timeMinutes} minutes`);
        if (step?.teacherActivity) lines.push(`Teacher Activity: ${step.teacherActivity}`);
        if (step?.learnerActivity) lines.push(`Learner Activity: ${step.learnerActivity}`);
        if (step?.teachingMethod) lines.push(`Teaching Method: ${step.teachingMethod}`);
        if (step?.assessmentCheck) lines.push(`Assessment Check: ${step.assessmentCheck}`);
        if (step?.concretisedLearningPoint) {
          lines.push(`Learning Point: ${step.concretisedLearningPoint}`);
        }
        lines.push("");
      });
    }

    if (Array.isArray(lessonPlan.keyVocabulary) && lessonPlan.keyVocabulary.length) {
      lines.push("KEY VOCABULARY");
      lines.push("-".repeat(14));
      lessonPlan.keyVocabulary.forEach((item, i) => {
        const word = item?.word ?? "";
        const meaning = item?.simpleMeaning ?? "";
        lines.push(`${i + 1}. ${word}${meaning ? `: ${meaning}` : ""}`);
      });
      lines.push("");
    }

    if (asStringArray(lessonPlan.commonMisconceptions).length) {
      lines.push("COMMON MISCONCEPTIONS");
      lines.push("-".repeat(22));
      asStringArray(lessonPlan.commonMisconceptions).forEach((item, i) => {
        lines.push(`${i + 1}. ${item}`);
      });
      lines.push("");
    }

    if (lessonPlan.differentiation) {
      lines.push("DIFFERENTIATION");
      lines.push("-".repeat(15));
      if (lessonPlan.differentiation.supportForStrugglingLearners) {
        lines.push(
          `Support for Struggling Learners: ${lessonPlan.differentiation.supportForStrugglingLearners}`
        );
      }
      if (lessonPlan.differentiation.supportForAverageLearners) {
        lines.push(
          `Support for Average Learners: ${lessonPlan.differentiation.supportForAverageLearners}`
        );
      }
      if (lessonPlan.differentiation.challengeForAdvancedLearners) {
        lines.push(
          `Challenge for Advanced Learners: ${lessonPlan.differentiation.challengeForAdvancedLearners}`
        );
      }
      lines.push("");
    }

    if (asStringArray(lessonPlan.boardSummary).length) {
      lines.push("BOARD SUMMARY");
      lines.push("-".repeat(13));
      asStringArray(lessonPlan.boardSummary).forEach((item, i) => {
        lines.push(`${i + 1}. ${item}`);
      });
      lines.push("");
    }

    if (Array.isArray(lessonPlan.evaluation) && lessonPlan.evaluation.length) {
      lines.push("EVALUATION");
      lines.push("-".repeat(10));
      lessonPlan.evaluation.forEach((item, i) => {
        if (typeof item === "string") {
          lines.push(`${i + 1}. ${item}`);
        } else {
          lines.push(`${i + 1}. ${item?.question ?? "Question"}`);
          if (item?.markingGuide) {
            lines.push(`   Marking Guide: ${item.markingGuide}`);
          }
        }
      });
      lines.push("");
    }

    if (asStringArray(lessonPlan.exitTicket).length) {
      lines.push("EXIT TICKET");
      lines.push("-".repeat(11));
      asStringArray(lessonPlan.exitTicket).forEach((item, i) => {
        lines.push(`${i + 1}. ${item}`);
      });
      lines.push("");
    }

    if (asStringArray(lessonPlan.assignment).length) {
      lines.push("ASSIGNMENT");
      lines.push("-".repeat(10));
      asStringArray(lessonPlan.assignment).forEach((item, i) => {
        lines.push(`${i + 1}. ${item}`);
      });
      lines.push("");
    }

    if (realLifeItems.length) {
      lines.push("REAL-LIFE APPLICATIONS");
      lines.push("-".repeat(22));
      realLifeItems.forEach((item, i) => {
        lines.push(`${i + 1}. ${item}`);
      });
      lines.push("");
    }

    if (result.lessonNotes) {
      lines.push("LESSON NOTES");
      lines.push("-".repeat(12));
      lines.push(String(result.lessonNotes));
      lines.push("");
    }

    if (slides.length) {
      lines.push("SLIDE STRUCTURE");
      lines.push("-".repeat(15));
      slides.forEach((slide, i) => {
        lines.push(`${i + 1}. ${slide?.title ?? `Slide ${i + 1}`}`);
        const bullets = Array.isArray(slide?.bullets) ? slide.bullets : [];
        bullets.forEach((b) => lines.push(`- ${b}`));
        if (slide?.interactivePrompt) lines.push(`Activity: ${slide.interactivePrompt}`);
        if (slide?.imageQuery) lines.push(`Image Focus: ${slide.imageQuery}`);
        if (slide?.videoQuery) lines.push(`Video Search: ${slide.videoQuery}`);
        lines.push("");
      });
    }

    if (mcq.length) {
      lines.push("MULTIPLE CHOICE QUESTIONS");
      lines.push("-".repeat(25));
      mcq.forEach((item, i) => {
        lines.push(`${i + 1}. ${item?.q ?? "Question"}`);
        const options = Array.isArray(item?.options) ? item.options : [];
        options.forEach((opt, j) => {
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
      theory.forEach((item, i) => {
        lines.push(`${i + 1}. ${item?.question ?? item?.q ?? "Question"}`);
        if (item?.markingGuide) lines.push(`Marking Guide: ${item.markingGuide}`);
        lines.push("");
      });
    }

    if (liveApps.length) {
      lines.push("LIVE / REAL-WORLD APPLICATIONS");
      lines.push("-".repeat(30));
      liveApps.forEach((item, i) => {
        lines.push(`${i + 1}. ${item}`);
      });
      lines.push("");
    }

    if (Array.isArray(result.references) && result.references.length) {
      lines.push("REFERENCES");
      lines.push("-".repeat(10));
      result.references.forEach((item, i) => {
        lines.push(`${i + 1}. ${item}`);
      });
      lines.push("");
    }

    lines.push("Generated with LessonForge");
    return lines.join("\n");
  }

  function handleDownloadLessonStructure() {
    if (!result) return;

    const safeSubject = (meta.subject ?? subject ?? "subject")
      .replace(/[^\w\s-]/g, "")
      .trim()
      .replace(/\s+/g, "_");
    const safeTopic = (meta.topic ?? topic ?? "topic")
      .replace(/[^\w\s-]/g, "")
      .trim()
      .replace(/\s+/g, "_");

    const content = buildLessonStructureText();
    downloadFile(`LessonForge_${safeSubject}_${safeTopic}_Structure.txt`, content);
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

  const lessonTitle = getLessonTitle(result, subject, topic);
  const realLifeItems = getRealLifeItems(result);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Generate Lesson Pack</h1>
        <p className="mt-1 text-sm text-slate-600">
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
              className="inline-flex rounded-lg border border-amber-300 bg-white px-3 py-2 text-xs font-semibold text-amber-900 hover:bg-amber-100"
            >
              Learn more
            </button>
          </div>
        </div>
      ) : null}

      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <Field label="Curriculum / School System">
            <select
              value={curriculum}
              onChange={(e) => setCurriculum(e.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-violet-400"
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
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-violet-400"
            >
              {SCHOOL_LEVEL_OPTIONS.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </Field>

          <Field label="Subject">
            <input
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="e.g., Economics"
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-violet-400"
            />
          </Field>

          <Field label="Class">
            <input
              value={grade}
              onChange={(e) => setGrade(e.target.value)}
              placeholder="e.g., JSS 2, Grade 5, SS 1"
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-violet-400"
            />
          </Field>

          <Field label="Topic" full>
            <input
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              placeholder="e.g., Inflation and Deflation"
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-violet-400"
            />
          </Field>

          <Field label="Number of Slides">
            <input
              type="number"
              min={1}
              max={20}
              value={numberOfSlides}
              onChange={(e) => setNumberOfSlides(Number(e.target.value))}
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-violet-400"
            />
          </Field>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-3">
          <button
            onClick={onGenerate}
            disabled={
              loading ||
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

          {loading && loadingStep ? (
            <span className="text-sm text-slate-700 animate-pulse">{loadingStep}</span>
          ) : saving ? (
            <span className="text-sm text-slate-700">Saving to Library…</span>
          ) : saveMsg ? (
            <span className="text-sm text-emerald-700">{saveMsg}</span>
          ) : null}

          {error ? <span className="text-sm text-red-600">{error}</span> : null}
        </div>

        <p className="mt-3 text-xs text-slate-500">
          🔒 Generation + saving happens securely under your account.
        </p>
      </div>

      {!result ? (
        <div className="rounded-2xl border border-dashed border-slate-200 bg-white p-8 text-sm text-slate-500">
          Your generated lesson pack will show here.
        </div>
      ) : (
        <div className="space-y-8">
          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
              <div>
                <div className="text-xs text-slate-500">Topic</div>
                <div className="mt-1 text-xl font-bold text-slate-900">
                  {meta.topic ?? topic}
                </div>
                <div className="mt-1 text-sm text-slate-600">
                  {meta.subject ?? subject} • {meta.grade ?? grade} •{" "}
                  {meta.curriculum ?? curriculum} • {meta.schoolLevel ?? schoolLevel} •{" "}
                  {meta.numberOfSlides ?? numberOfSlides} slides
                </div>
              </div>

              <button
                type="button"
                onClick={handleDownloadLessonStructure}
                className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-800 hover:bg-slate-100"
              >
                Download Structure
              </button>
            </div>
          </section>

          {result?.lessonPlan ? (
            <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm space-y-5">
              <h3 className="text-xl font-extrabold text-slate-900 tracking-tight">
                Lesson Plan
              </h3>

              <div>
                <p className="text-sm font-semibold text-slate-800">Title</p>
                <p className="mt-1 text-sm text-slate-700">{lessonTitle}</p>
              </div>

              {!!asStringArray(result.lessonPlan.performanceObjectives).length && (
                <div>
                  <p className="text-sm font-semibold text-slate-800">
                    Performance Objectives
                  </p>
                  <ul className="mt-2 list-disc pl-6 space-y-2 text-sm text-slate-700">
                    {asStringArray(result.lessonPlan.performanceObjectives).map((item, i) => (
                      <li key={i}>{item}</li>
                    ))}
                  </ul>
                </div>
              )}

              {!!asStringArray(result.lessonPlan.successCriteria).length && (
                <div>
                  <p className="text-sm font-semibold text-slate-800">Success Criteria</p>
                  <ul className="mt-2 list-disc pl-6 space-y-2 text-sm text-slate-700">
                    {asStringArray(result.lessonPlan.successCriteria).map((item, i) => (
                      <li key={i}>{item}</li>
                    ))}
                  </ul>
                </div>
              )}

              {!!asStringArray(result.lessonPlan.instructionalMaterials).length && (
                <div>
                  <p className="text-sm font-semibold text-slate-800">
                    Instructional Materials
                  </p>
                  <ul className="mt-2 list-disc pl-6 space-y-2 text-sm text-slate-700">
                    {asStringArray(result.lessonPlan.instructionalMaterials).map((item, i) => (
                      <li key={i}>{item}</li>
                    ))}
                  </ul>
                </div>
              )}

              {!!asStringArray(result.lessonPlan.lifeNatureActivities).length && (
                <div>
                  <p className="text-sm font-semibold text-slate-800">
                    Life / Nature Activities
                  </p>
                  <ul className="mt-2 list-disc pl-6 space-y-2 text-sm text-slate-700">
                    {asStringArray(result.lessonPlan.lifeNatureActivities).map((item, i) => (
                      <li key={i}>{item}</li>
                    ))}
                  </ul>
                </div>
              )}

              {!!asStringArray(result.lessonPlan.crossCurricularActivities).length && (
                <div>
                  <p className="text-sm font-semibold text-slate-800">
                    Cross-Curricular Activities
                  </p>
                  <ul className="mt-2 list-disc pl-6 space-y-2 text-sm text-slate-700">
                    {asStringArray(result.lessonPlan.crossCurricularActivities).map((item, i) => (
                      <li key={i}>{item}</li>
                    ))}
                  </ul>
                </div>
              )}

              {result.lessonPlan.previousKnowledge ? (
                <div>
                  <p className="text-sm font-semibold text-slate-800">Previous Knowledge</p>
                  <p className="mt-1 text-sm text-slate-700 whitespace-pre-wrap">
                    {result.lessonPlan.previousKnowledge}
                  </p>
                </div>
              ) : null}

              {result.lessonPlan.introduction ? (
                <div>
                  <p className="text-sm font-semibold text-slate-800">Introduction</p>
                  <p className="mt-1 text-sm text-slate-700 whitespace-pre-wrap">
                    {result.lessonPlan.introduction}
                  </p>
                </div>
              ) : null}

              {!!Array.isArray(result.lessonPlan.keyVocabulary) &&
                result.lessonPlan.keyVocabulary.length > 0 && (
                  <div>
                    <p className="text-sm font-semibold text-slate-800">Key Vocabulary</p>
                    <ul className="mt-2 list-disc pl-6 space-y-2 text-sm text-slate-700">
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
                  <p className="text-sm font-semibold text-slate-800">
                    Common Misconceptions
                  </p>
                  <ul className="mt-2 list-disc pl-6 space-y-2 text-sm text-slate-700">
                    {asStringArray(result.lessonPlan.commonMisconceptions).map((item, i) => (
                      <li key={i}>{item}</li>
                    ))}
                  </ul>
                </div>
              )}

              {!!result.lessonPlan.steps?.length && (
                <div className="space-y-4">
                  <p className="text-sm font-semibold text-slate-800">
                    Lesson Delivery Steps
                  </p>
                  {result.lessonPlan.steps.map((step, i) => {
                    const stepNumber = step.stepNumber ?? step.step ?? i + 1;
                    const stepTitle = step.stepTitle ?? step.title ?? `Step ${i + 1}`;

                    return (
                      <div
                        key={i}
                        className="rounded-xl border border-slate-200 bg-slate-50 p-4 space-y-2"
                      >
                        <p className="font-semibold text-slate-900">
                          Step {stepNumber}: {stepTitle}
                        </p>

                        {step.timeMinutes ? (
                          <p className="text-sm text-slate-700">
                            <span className="font-semibold">Time:</span> {step.timeMinutes} mins
                          </p>
                        ) : null}

                        {step.teacherActivity ? (
                          <p className="text-sm text-slate-700">
                            <span className="font-semibold">Teacher Activity:</span>{" "}
                            {step.teacherActivity}
                          </p>
                        ) : null}

                        {step.learnerActivity ? (
                          <p className="text-sm text-slate-700">
                            <span className="font-semibold">Learner Activity:</span>{" "}
                            {step.learnerActivity}
                          </p>
                        ) : null}

                        {step.teachingMethod ? (
                          <p className="text-sm text-slate-700">
                            <span className="font-semibold">Teaching Method:</span>{" "}
                            {step.teachingMethod}
                          </p>
                        ) : null}

                        {step.assessmentCheck ? (
                          <p className="text-sm text-slate-700">
                            <span className="font-semibold">Assessment Check:</span>{" "}
                            {step.assessmentCheck}
                          </p>
                        ) : null}

                        {step.concretisedLearningPoint ? (
                          <p className="text-sm text-slate-700">
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
                  <p className="text-sm font-semibold text-slate-800">Differentiation</p>

                  {result.lessonPlan.differentiation.supportForStrugglingLearners ? (
                    <p className="text-sm text-slate-700">
                      <span className="font-semibold">Support for Struggling Learners:</span>{" "}
                      {result.lessonPlan.differentiation.supportForStrugglingLearners}
                    </p>
                  ) : null}

                  {result.lessonPlan.differentiation.supportForAverageLearners ? (
                    <p className="text-sm text-slate-700">
                      <span className="font-semibold">Support for Average Learners:</span>{" "}
                      {result.lessonPlan.differentiation.supportForAverageLearners}
                    </p>
                  ) : null}

                  {result.lessonPlan.differentiation.challengeForAdvancedLearners ? (
                    <p className="text-sm text-slate-700">
                      <span className="font-semibold">Challenge for Advanced Learners:</span>{" "}
                      {result.lessonPlan.differentiation.challengeForAdvancedLearners}
                    </p>
                  ) : null}
                </div>
              ) : null}

              {!!asStringArray(result.lessonPlan.boardSummary).length && (
                <div>
                  <p className="text-sm font-semibold text-slate-800">Board Summary</p>
                  <ul className="mt-2 list-disc pl-6 space-y-2 text-sm text-slate-700">
                    {asStringArray(result.lessonPlan.boardSummary).map((item, i) => (
                      <li key={i}>{item}</li>
                    ))}
                  </ul>
                </div>
              )}

              {!!result.lessonPlan.evaluation?.length && (
                <div>
                  <p className="text-sm font-semibold text-slate-800">Evaluation</p>
                  <ul className="mt-2 list-disc pl-6 space-y-3 text-sm text-slate-700">
                    {result.lessonPlan.evaluation.map((item, i) => (
                      <li key={i}>
                        {typeof item === "string" ? (
                          item
                        ) : (
                          <div className="space-y-1">
                            <div>{item.question}</div>
                            {item.markingGuide ? (
                              <div className="text-xs text-slate-500">
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
                  <p className="text-sm font-semibold text-slate-800">Exit Ticket</p>
                  <ul className="mt-2 list-disc pl-6 space-y-2 text-sm text-slate-700">
                    {asStringArray(result.lessonPlan.exitTicket).map((item, i) => (
                      <li key={i}>{item}</li>
                    ))}
                  </ul>
                </div>
              )}

              {!!asStringArray(result.lessonPlan.assignment).length && (
                <div>
                  <p className="text-sm font-semibold text-slate-800">Assignment</p>
                  <ul className="mt-2 list-disc pl-6 space-y-2 text-sm text-slate-700">
                    {asStringArray(result.lessonPlan.assignment).map((item, i) => (
                      <li key={i}>{item}</li>
                    ))}
                  </ul>
                </div>
              )}

              {!!realLifeItems.length && (
                <div>
                  <p className="text-sm font-semibold text-slate-800">
                    Real-life Applications
                  </p>
                  <ul className="mt-2 list-disc pl-6 space-y-2 text-sm text-slate-700">
                    {realLifeItems.map((item, i) => (
                      <li key={i}>{item}</li>
                    ))}
                  </ul>
                </div>
              )}
            </section>
          ) : null}

          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm space-y-2">
            <h3 className="text-xl font-extrabold text-slate-900 tracking-tight">
              Lesson Notes
            </h3>
            <p className="whitespace-pre-wrap text-sm text-slate-700 leading-relaxed">
              {result.lessonNotes || "No lesson notes generated."}
            </p>
          </section>

          {Array.isArray(result.references) && result.references.length ? (
            <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm space-y-2">
              <h3 className="text-xl font-extrabold text-slate-900 tracking-tight">
                References
              </h3>
              <ul className="list-disc pl-6 space-y-2 text-sm text-slate-700">
                {result.references.map((ref, i) => (
                  <li key={i}>{ref}</li>
                ))}
              </ul>
            </section>
          ) : null}

          <section className="space-y-4">
            <h3 className="text-xl font-extrabold text-slate-900 tracking-tight">
              Slides
            </h3>

            {slides.length ? (
              <div className="grid gap-6">
                {slides.map((s, i) => {
                  const title = s?.title || "Untitled slide";
                  const bullets = Array.isArray(s?.bullets) ? s.bullets : [];
                  const videoQuery = s?.videoQuery || title || `${subject} ${topic}`.trim();
                  const activity =
                    s?.interactivePrompt || "No interactive activity provided.";
                  const imgSrc = s?.image || FALLBACK_IMG;

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

                      <div className="rounded-xl overflow-hidden border bg-slate-100">
                        <button
                          type="button"
                          onClick={() => setPreviewImage({ src: imgSrc, title })}
                          className="block w-full text-left"
                        >
                          <img
                            src={imgSrc}
                            alt={title}
                            className="w-full h-52 object-cover transition hover:scale-[1.01]"
                            onError={(e) => {
                              e.currentTarget.src = FALLBACK_IMG;
                            }}
                          />
                        </button>
                      </div>

                      <div className="flex flex-wrap gap-3 text-sm">
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
                        <ul className="list-disc pl-6 space-y-2 text-slate-800 font-medium">
                          {bullets.map((b, j) => (
                            <li key={j}>{b}</li>
                          ))}
                        </ul>
                      ) : (
                        <p className="text-sm text-slate-600">No bullet points.</p>
                      )}

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

                      <div className="rounded-xl border bg-yellow-50 p-3 text-sm text-slate-900">
                        <span className="font-bold">👩🏽‍🏫 Classroom Activity:</span>{" "}
                        {activity}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-sm text-slate-600">No slides generated yet.</p>
            )}
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

          {mcq.length ? (
            <section className="space-y-4">
              <h3 className="text-2xl font-bold text-slate-900">
                📝 Multiple Choice Questions
              </h3>

              <div className="space-y-6">
                {mcq.map((q, i) => {
                  const options = Array.isArray(q?.options) ? q.options : [];
                  const shuffledOptions = shuffleArray(options);

                  return (
                    <div
                      key={i}
                      className="rounded-xl border border-slate-200 p-5 bg-white shadow-sm"
                    >
                      <p className="font-semibold text-lg mb-3 text-slate-900">
                        {i + 1}. {q?.q || "Question text missing"}
                      </p>
                      <ul className="space-y-2">
                        {shuffledOptions.map((opt, j) => (
                          <li key={j} className="flex items-start gap-3 text-slate-800">
                            <span className="font-bold text-indigo-600 min-w-[24px]">
                              {String.fromCharCode(65 + j)}.
                            </span>
                            <span>{opt}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  );
                })}
              </div>
            </section>
          ) : null}

          {theory.length ? (
            <section className="space-y-4">
              <h3 className="text-2xl font-bold text-slate-900">✍️ Theory Questions</h3>

              <div className="space-y-4">
                {theory.map((q, i) => (
                  <div
                    key={i}
                    className="rounded-xl border border-slate-200 p-5 bg-white shadow-sm"
                  >
                    <p className="font-semibold text-lg mb-2 text-slate-900">
                      {i + 1}. {q?.question || q?.q || "Question text missing"}
                    </p>

                    {q?.markingGuide ? (
                      <div className="mt-3 p-3 bg-slate-50 rounded-lg border border-slate-200">
                        <p className="text-xs font-semibold text-slate-700 mb-1">
                          Marking Guide:
                        </p>
                        <p className="text-sm text-slate-600">{q.markingGuide}</p>
                      </div>
                    ) : null}
                  </div>
                ))}
              </div>
            </section>
          ) : null}

          {Array.isArray(result.liveApplications) && result.liveApplications.length ? (
            <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm space-y-2">
              <h3 className="text-xl font-extrabold text-slate-900 tracking-tight">
                Live / Real-World Applications
              </h3>
              <ul className="list-disc pl-6 space-y-2 text-sm text-slate-700">
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
      <div className="mb-1 text-xs font-medium text-slate-600">{label}</div>
      {children}
    </div>
  );
}