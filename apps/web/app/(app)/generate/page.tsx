"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createBrowserSupabase } from "@/lib/supabase/browser";
import { useProfile } from "@/lib/useProfile";
import TeacherPaywallModal from "@/components/billing/TeacherPaywallModal";
import GenerationProgress from "@/components/generation/GenerationProgress";
import { useGenerationProgress } from "@/components/generation/useGenerationProgress";
import { useNetworkStatus } from "@/components/network/NetworkProvider";
import { GenerationStage } from "@/components/generation/generationStages";
import { LESSON_PACK_CREDIT_COST } from "@/lib/billing/pricing";

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
    imageQuery?: string;
    videoQuery?: string;
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

const SCHOOL_LEVEL_OPTIONS = [
  { label: "EYFS / Nursery", value: "EYFS" },
  { label: "Primary", value: "Primary" },
  { label: "Secondary", value: "Secondary" },
];

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
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationStage, setGenerationStage] = useState<GenerationStage>("queued");
  const { isOnline, isUnstable } = useNetworkStatus();
  const networkRef = useRef({ isOnline, isUnstable });

  useEffect(() => {
    networkRef.current = { isOnline, isUnstable };
  }, [isOnline, isUnstable]);

  const { steps, currentStepIndex, progress, completeProgress, failProgress } = useGenerationProgress({
    isGenerating,
    stage: generationStage,
  });

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

    if (!isOnline) {
      setError("You’re offline. Reconnect to generate your lesson pack.");
      setLoading(false);
      setIsGenerating(false);
      return;
    }

    setLoading(true);
    setIsGenerating(true);
    setSaving(false);
    setError(null);
    setSaveMsg(null);
    setResult(null);
    setGenerationStage("planning");

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session?.access_token) {
        throw new Error("Session expired. Please login again.");
      }

      const stageProgression = [
        { stage: "planning" as GenerationStage, delay: 2000 },
        { stage: "notes" as GenerationStage, delay: 5000 },
        { stage: "assessments" as GenerationStage, delay: 5000 },
        { stage: "slides_images" as GenerationStage, delay: 8000 },
      ];

      let stageIndex = 0;
      const progressInterval = window.setInterval(() => {
        if (!networkRef.current.isOnline || networkRef.current.isUnstable) return;
        if (stageIndex < stageProgression.length - 1) {
          stageIndex++;
          setGenerationStage(stageProgression[stageIndex].stage);
        }
      }, 5000);

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

      // Clear the stage progression interval once API responds
      clearInterval(progressInterval);

      const json = await res.json();

      if (!res.ok) {
        if (res.status === 402) {
          setShowPaywall(true);
        }
        setGenerationStage("failed");
        failProgress();
        throw new Error(json?.error || json?.message || "Generation failed");
      }

      const generated = json.data as Generated;
      setResult(generated);

      // NOW move to saving stage - only when we're actually persisting
      setGenerationStage("saving");
      setSaving(true);

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
        setGenerationStage("failed");
        failProgress();
        throw insertError;
      }

      // Success! Move to completed
      setGenerationStage("completed");
      completeProgress();
      setSaveMsg("✅ Auto-saved to Library");
      setIsGenerating(false);
    } catch (e: any) {
      setError(e?.message || "Something went wrong");
      setIsGenerating(false);
    } finally {
      setLoading(false);
      setSaving(false);
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
        if (step?.guidedQuestions?.length) {
          lines.push("Guided Questions:");
          step.guidedQuestions.forEach((question, j) => {
            lines.push(`  ${j + 1}. ${question}`);
          });
        }
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
        if (typeof item === "object" && item?.question) {
          lines.push(`${i + 1}. ${item.question}`);
          if (item.markingGuide) {
            lines.push(`   Marking Guide: ${item.markingGuide}`);
          }
        } else if (typeof item === "string") {
          lines.push(`${i + 1}. ${item}`);
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
      if (typeof result.lessonNotes === "string") {
        lines.push("LESSON NOTES");
        lines.push("-".repeat(12));
        lines.push(String(result.lessonNotes));
        lines.push("");
      } else {
        if (result.lessonNotes.introduction) {
          lines.push("LESSON NOTES INTRODUCTION");
          lines.push("-".repeat(25));
          lines.push(result.lessonNotes.introduction);
          lines.push("");
        }
        if (result.lessonNotes.keyConcepts?.length) {
          lines.push("KEY CONCEPTS");
          lines.push("-".repeat(13));
          result.lessonNotes.keyConcepts.forEach((concept, i) => {
            lines.push(`${i + 1}. ${concept.subheading || "Concept"}`);
            if (concept.content) lines.push(`   ${concept.content}`);
            lines.push("");
          });
        }
        if (result.lessonNotes.workedExamples?.length) {
          lines.push("WORKED EXAMPLES");
          lines.push("-".repeat(15));
          result.lessonNotes.workedExamples.forEach((example, i) => {
            lines.push(`${i + 1}. ${example.title || "Example"}`);
            if (example.problem) lines.push(`   Problem: ${example.problem}`);
            if (example.steps?.length) {
              lines.push("   Steps:");
              example.steps.forEach((step, j) => lines.push(`     ${j + 1}. ${step}`));
            }
            if (example.finalAnswer) lines.push(`   Final Answer: ${example.finalAnswer}`);
            if (example.explanation) lines.push(`   Explanation: ${example.explanation}`);
            lines.push("");
          });
        }
        if (result.lessonNotes.summaryPoints?.length) {
          lines.push("SUMMARY POINTS");
          lines.push("-".repeat(14));
          result.lessonNotes.summaryPoints.forEach((point, i) => {
            lines.push(`${i + 1}. ${point}`);
          });
          lines.push("");
        }
        if (result.lessonNotes.exitTicket?.length) {
          lines.push("EXIT TICKET QUESTIONS");
          lines.push("-".repeat(20));
          result.lessonNotes.exitTicket.forEach((item, i) => {
            lines.push(`${i + 1}. ${item}`);
          });
          lines.push("");
        }
        if (result.lessonNotes.realLifeApplications?.length) {
          lines.push("LESSON NOTES - REAL-LIFE APPLICATIONS");
          lines.push("-".repeat(31));
          result.lessonNotes.realLifeApplications.forEach((item, i) => {
            lines.push(`${i + 1}. ${item}`);
          });
          lines.push("");
        }
        if (result.lessonNotes.keyVocabulary?.length) {
          lines.push("KEY VOCABULARY");
          lines.push("-".repeat(14));
          result.lessonNotes.keyVocabulary.forEach((item, i) => {
            lines.push(`${i + 1}. ${item.word || ""}: ${item.meaning || ""}`);
          });
          lines.push("");
        }
      }
    }

    if (slides.length) {
      lines.push("SLIDE STRUCTURE");
      lines.push("-".repeat(15));
      slides.forEach((slide, i) => {
        const slideNumber = slide?.slideNumber ?? i + 1;
        const slideType = slide?.slideType ? ` (${slide.slideType})` : "";
        lines.push(`${slideNumber}. ${slide?.title ?? `Slide ${slideNumber}`}${slideType}`);
        if (slide?.teacherPrompt) lines.push(`Teacher Prompt: ${slide.teacherPrompt}`);
        if (slide?.studentTask) lines.push(`Student Task: ${slide.studentTask}`);
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
          <GenerationProgress
            steps={steps}
            currentStepIndex={currentStepIndex}
            progress={progress}
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
                <div className="mt-1 text-sm text-[var(--text-secondary)]">
                  {meta.subject ?? subject} • {meta.grade ?? grade} •{" "}
                  {meta.curriculum ?? curriculum} • {meta.schoolLevel ?? schoolLevel} •{" "}
                  {meta.numberOfSlides ?? numberOfSlides} slides
                </div>
              </div>

              <button
                type="button"
                onClick={handleDownloadLessonStructure}
                className="rounded-xl border border-[var(--border)] bg-[var(--card)] px-4 py-2 text-sm font-semibold text-[var(--text-primary)] hover:bg-slate-100"
              >
                Download Structure
              </button>
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
                  const imgSrc = s?.image || FALLBACK_IMG;

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