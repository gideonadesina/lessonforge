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

// ─── Fetch image and encode as base64 for offline embedding ───────────────────
async function fetchImageAsBase64(url: string): Promise<string> {
  try {
    const res = await fetch(url, { mode: "cors" });
    const blob = await res.blob();
    return await new Promise<string>((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = () => resolve(url); // fall back to URL if encode fails
      reader.readAsDataURL(blob);
    });
  } catch {
    return url; // fall back to URL on CORS / network error
  }
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
  const [generationStage, setGenerationStage] = useState<GenerationStage>("queued");
  const [downloadingPack, setDownloadingPack] = useState(false); // ← NEW
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
  const [redirectingToUpgrade, setRedirectingToUpgrade] = useState(false);

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
    (window as any).__FORGE_CONTEXT__ = {
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
    age,          // ← NEW
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
      setError("You're offline. Reconnect to generate your lesson pack.");
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
          age: age.trim(),           // ← NEW
          topic: topic.trim(),
          numberOfSlides,
          durationMins,
        }),
      });

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
            age: age.trim(),          // ← NEW
          },
        },
      });

      if (insertError) {
        console.error("Save failed:", insertError.message);
        setGenerationStage("failed");
        failProgress();
        throw insertError;
      }

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
    if (age) lines.push(`Age: ${age}`);   // ← NEW
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
        if (slide?.videoQuery) lines.push(`Video Link: ${youtubeSearchUrl(slide.videoQuery)}`);
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
        if (item?.explanation) lines.push(`   Explanation: ${item.explanation}`);
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

  // ─── Build complete offline HTML pack (embeds all images as base64) ──────────
  async function buildCompletePackHTML(): Promise<string> {
    if (!result) return "";

    const lessonPlan = result.lessonPlan ?? {};
    const lessonNotes = result.lessonNotes;
    const slidesData = Array.isArray(result.slides) ? result.slides : [];
    const mcqData = result.quiz?.mcq ?? [];
    const theoryData = result.quiz?.theory ?? [];
    const realLifeItems = getRealLifeItems(result);
    const liveApps = result.liveApplications ?? [];
    const lessonTitle = getLessonTitle(result, subject, topic);
    const subjectLabel = meta.subject ?? subject;
    const topicLabel = meta.topic ?? topic;
    const gradeLabel = meta.grade ?? grade;
    const curriculumLabel = meta.curriculum ?? curriculum;
    const schoolLevelLabel = meta.schoolLevel ?? schoolLevel;
    const generatedDate = new Date().toLocaleDateString("en-GB", {
      day: "numeric", month: "long", year: "numeric",
    });

    // Fetch & encode all slide images
    const imageCache: Record<string, string> = {};
    await Promise.all(
      slidesData.map(async (slide) => {
        const src = slide.image || FALLBACK_IMG;
        if (!imageCache[src]) {
          imageCache[src] = await fetchImageAsBase64(src);
        }
      })
    );

    // ── Helpers ──────────────────────────────────────────────────────────────
    const esc = (s: string) =>
      String(s)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;");

    function sectionHeader(title: string, emoji = "") {
      return `<div class="section-header"><h2>${emoji ? emoji + " " : ""}${esc(title)}</h2></div>`;
    }

    function infoGrid(items: Array<[string, string]>) {
      return `<div class="info-grid">${items
        .filter(([, v]) => v)
        .map(([k, v]) => `<div class="info-item"><span class="info-label">${esc(k)}</span><span class="info-value">${esc(v)}</span></div>`)
        .join("")}</div>`;
    }

    function listBlock(items: string[], ordered = false) {
      if (!items.length) return "";
      const tag = ordered ? "ol" : "ul";
      return `<${tag} class="content-list">${items.map((i) => `<li>${esc(i)}</li>`).join("")}</${tag}>`;
    }

    function fieldBlock(label: string, content: string) {
      if (!content) return "";
      return `<div class="field-block"><div class="field-label">${esc(label)}</div><div class="field-content">${content}</div></div>`;
    }

    // ── Cover Page ────────────────────────────────────────────────────────────
    const coverHTML = `
<div class="cover-page">
  <div class="cover-logo">LessonForge</div>
  <div class="cover-badge">Complete Lesson Pack</div>
  <h1 class="cover-title">${esc(topicLabel || topic)}</h1>
  <p class="cover-subject">${esc(subjectLabel || subject)}</p>
  <div class="cover-meta">
    ${infoGrid([
      ["Class / Grade", gradeLabel || grade],
      ["Age Group", age],
      ["School Level", schoolLevelLabel || schoolLevel],
      ["Curriculum", curriculumLabel || curriculum],
      ["Duration", `${meta.durationMins ?? 40} minutes`],
      ["Slides", String(meta.numberOfSlides ?? numberOfSlides)],
      ["Generated", generatedDate],
    ])}
  </div>
</div>
<div class="page-break"></div>`;

    // ── Table of Contents ─────────────────────────────────────────────────────
    const tocItems = [
      "Lesson Plan",
      "Lesson Notes",
      ...(slidesData.length ? ["Slides & Images"] : []),
      ...(slidesData.some((s) => s.videoQuery) ? ["Video Resources"] : []),
      ...(mcqData.length ? ["Multiple Choice Questions"] : []),
      ...(theoryData.length ? ["Theory Questions"] : []),
      ...(Array.isArray(result.references) && result.references.length ? ["References"] : []),
    ];

    const tocHTML = `
<div class="toc-page">
  ${sectionHeader("Contents", "📋")}
  <ol class="toc-list">
    ${tocItems.map((item) => `<li>${esc(item)}</li>`).join("")}
  </ol>
</div>
<div class="page-break"></div>`;

    // ── Lesson Plan ───────────────────────────────────────────────────────────
    let lessonPlanHTML = sectionHeader("Lesson Plan", "📚");

    lessonPlanHTML += fieldBlock("Lesson Title", `<strong>${esc(lessonTitle)}</strong>`);

    if (asStringArray(lessonPlan.performanceObjectives).length)
      lessonPlanHTML += fieldBlock("Performance Objectives", listBlock(asStringArray(lessonPlan.performanceObjectives)));
    if (asStringArray(lessonPlan.successCriteria).length)
      lessonPlanHTML += fieldBlock("Success Criteria", listBlock(asStringArray(lessonPlan.successCriteria)));
    if (asStringArray(lessonPlan.instructionalMaterials).length)
      lessonPlanHTML += fieldBlock("Instructional Materials", listBlock(asStringArray(lessonPlan.instructionalMaterials)));
    if (asStringArray(lessonPlan.lifeNatureActivities).length)
      lessonPlanHTML += fieldBlock("Life / Nature Activities", listBlock(asStringArray(lessonPlan.lifeNatureActivities)));
    if (asStringArray(lessonPlan.crossCurricularActivities).length)
      lessonPlanHTML += fieldBlock("Cross-Curricular Activities", listBlock(asStringArray(lessonPlan.crossCurricularActivities)));
    if (lessonPlan.previousKnowledge)
      lessonPlanHTML += fieldBlock("Previous Knowledge", `<p>${esc(String(lessonPlan.previousKnowledge))}</p>`);
    if (lessonPlan.introduction)
      lessonPlanHTML += fieldBlock("Introduction", `<p>${esc(String(lessonPlan.introduction))}</p>`);

    if (Array.isArray(lessonPlan.keyVocabulary) && lessonPlan.keyVocabulary.length) {
      const vocabRows = lessonPlan.keyVocabulary
        .map((v) => `<tr><td><strong>${esc(v.word ?? "")}</strong></td><td>${esc(v.simpleMeaning ?? "")}</td></tr>`)
        .join("");
      lessonPlanHTML += fieldBlock(
        "Key Vocabulary",
        `<table class="vocab-table"><thead><tr><th>Word</th><th>Meaning</th></tr></thead><tbody>${vocabRows}</tbody></table>`
      );
    }

    if (asStringArray(lessonPlan.commonMisconceptions).length)
      lessonPlanHTML += fieldBlock("Common Misconceptions", listBlock(asStringArray(lessonPlan.commonMisconceptions)));

    if (Array.isArray(lessonPlan.steps) && lessonPlan.steps.length) {
      const stepsHTML = lessonPlan.steps.map((step, i) => {
        const num = step.stepNumber ?? step.step ?? i + 1;
        const title = step.stepTitle ?? step.title ?? `Step ${i + 1}`;
        const rows = [
          step.timeMinutes ? `<div class="step-row"><span class="step-key">⏱ Time:</span> ${esc(String(step.timeMinutes))} mins</div>` : "",
          step.teacherActivity ? `<div class="step-row"><span class="step-key">👩‍🏫 Teacher Activity:</span> ${esc(step.teacherActivity)}</div>` : "",
          step.learnerActivity ? `<div class="step-row"><span class="step-key">🎒 Learner Activity:</span> ${esc(step.learnerActivity)}</div>` : "",
          step.teachingMethod ? `<div class="step-row"><span class="step-key">📖 Teaching Method:</span> ${esc(step.teachingMethod)}</div>` : "",
          step.assessmentCheck ? `<div class="step-row"><span class="step-key">✅ Assessment Check:</span> ${esc(step.assessmentCheck)}</div>` : "",
          step.concretisedLearningPoint ? `<div class="step-row"><span class="step-key">💡 Learning Point:</span> ${esc(step.concretisedLearningPoint)}</div>` : "",
          step.guidedQuestions?.length
            ? `<div class="step-row"><span class="step-key">❓ Guided Questions:</span>${listBlock(step.guidedQuestions)}</div>`
            : "",
        ].filter(Boolean).join("");
        return `<div class="step-card"><div class="step-title">Step ${num}: ${esc(title)}</div>${rows}</div>`;
      }).join("");
      lessonPlanHTML += fieldBlock("Lesson Delivery Steps", stepsHTML);
    }

    if (lessonPlan.differentiation) {
      const diffContent = [
        lessonPlan.differentiation.supportForStrugglingLearners
          ? `<div class="diff-block diff-support"><strong>🟡 Struggling Learners:</strong> ${esc(lessonPlan.differentiation.supportForStrugglingLearners)}</div>` : "",
        lessonPlan.differentiation.supportForAverageLearners
          ? `<div class="diff-block diff-average"><strong>🔵 Average Learners:</strong> ${esc(lessonPlan.differentiation.supportForAverageLearners)}</div>` : "",
        lessonPlan.differentiation.challengeForAdvancedLearners
          ? `<div class="diff-block diff-advanced"><strong>🟢 Advanced Learners:</strong> ${esc(lessonPlan.differentiation.challengeForAdvancedLearners)}</div>` : "",
      ].filter(Boolean).join("");
      if (diffContent) lessonPlanHTML += fieldBlock("Differentiation", diffContent);
    }

    if (asStringArray(lessonPlan.boardSummary).length)
      lessonPlanHTML += fieldBlock("Board Summary", listBlock(asStringArray(lessonPlan.boardSummary)));

    if (Array.isArray(lessonPlan.evaluation) && lessonPlan.evaluation.length) {
      const evalList = lessonPlan.evaluation.map((item, i) => {
        if (typeof item === "string") return `<li>${esc(item)}</li>`;
        return `<li>${esc(item.question ?? "")}${item.markingGuide ? `<div class="marking-guide"><strong>Marking Guide:</strong> ${esc(item.markingGuide)}</div>` : ""}</li>`;
      }).join("");
      lessonPlanHTML += fieldBlock("Evaluation", `<ol class="content-list">${evalList}</ol>`);
    }

    if (asStringArray(lessonPlan.exitTicket).length)
      lessonPlanHTML += fieldBlock("Exit Ticket", listBlock(asStringArray(lessonPlan.exitTicket), true));
    if (asStringArray(lessonPlan.assignment).length)
      lessonPlanHTML += fieldBlock("Assignment", listBlock(asStringArray(lessonPlan.assignment), true));
    if (realLifeItems.length)
      lessonPlanHTML += fieldBlock("Real-Life Applications", listBlock(realLifeItems));

    const lessonPlanSection = `<div class="content-section">${lessonPlanHTML}</div><div class="page-break"></div>`;

    // ── Lesson Notes ──────────────────────────────────────────────────────────
    let lessonNotesHTML = sectionHeader("Lesson Notes", "📝");

    if (!lessonNotes) {
      lessonNotesHTML += `<p class="empty-state">No lesson notes generated.</p>`;
    } else if (typeof lessonNotes === "string") {
      lessonNotesHTML += `<div class="prose">${esc(lessonNotes).replace(/\n/g, "<br>")}</div>`;
    } else {
      if (lessonNotes.introduction)
        lessonNotesHTML += fieldBlock("Introduction", `<p>${esc(lessonNotes.introduction)}</p>`);

      if (lessonNotes.keyConcepts?.length) {
        const conceptsHTML = lessonNotes.keyConcepts.map((c, i) =>
          `<div class="concept-card"><div class="concept-heading">${esc(c.subheading || `Concept ${i + 1}`)}</div>${c.content ? `<p>${esc(c.content)}</p>` : ""}</div>`
        ).join("");
        lessonNotesHTML += fieldBlock("Key Concepts", conceptsHTML);
      }

      if (lessonNotes.workedExamples?.length) {
        const examplesHTML = lessonNotes.workedExamples.map((ex, i) => {
          const stepsHTML = ex.steps?.length
            ? `<div class="example-steps"><strong>Steps:</strong><ol>${ex.steps.map((s) => `<li>${esc(s)}</li>`).join("")}</ol></div>` : "";
          return `<div class="example-card">
            <div class="example-title">${esc(ex.title || `Example ${i + 1}`)}</div>
            ${ex.problem ? `<p><strong>Problem:</strong> ${esc(ex.problem)}</p>` : ""}
            ${stepsHTML}
            ${ex.finalAnswer ? `<p class="final-answer"><strong>✅ Final Answer:</strong> ${esc(ex.finalAnswer)}</p>` : ""}
            ${ex.explanation ? `<p><strong>Explanation:</strong> ${esc(ex.explanation)}</p>` : ""}
          </div>`;
        }).join("");
        lessonNotesHTML += fieldBlock("Worked Examples", examplesHTML);
      }

      if (lessonNotes.summaryPoints?.length)
        lessonNotesHTML += fieldBlock("Summary Points", listBlock(lessonNotes.summaryPoints));
      if (lessonNotes.realLifeApplications?.length)
        lessonNotesHTML += fieldBlock("Real-Life Applications", listBlock(lessonNotes.realLifeApplications));
      if (lessonNotes.exitTicket?.length)
        lessonNotesHTML += fieldBlock("Exit Ticket", listBlock(lessonNotes.exitTicket, true));

      if (lessonNotes.keyVocabulary?.length) {
        const vocabRows = lessonNotes.keyVocabulary
          .map((v) => `<tr><td><strong>${esc(v.word ?? "")}</strong></td><td>${esc(v.meaning ?? "")}</td></tr>`)
          .join("");
        lessonNotesHTML += fieldBlock(
          "Key Vocabulary",
          `<table class="vocab-table"><thead><tr><th>Word</th><th>Meaning</th></tr></thead><tbody>${vocabRows}</tbody></table>`
        );
      }
    }

    const lessonNotesSection = `<div class="content-section">${lessonNotesHTML}</div><div class="page-break"></div>`;

    // ── Slides ────────────────────────────────────────────────────────────────
    let slidesSection = "";
    if (slidesData.length) {
      let slidesHTML = sectionHeader("Slides & Images", "🖼️");
      slidesData.forEach((slide, i) => {
        const num = slide.slideNumber ?? i + 1;
        const title = slide.title || `Slide ${num}`;
        const bullets = Array.isArray(slide.bullets) ? slide.bullets : [];
        const imgSrc = imageCache[slide.image || FALLBACK_IMG] || slide.image || FALLBACK_IMG;
        const videoLink = youtubeSearchUrl(slide.videoQuery || title);

        slidesHTML += `
<div class="slide-card">
  <div class="slide-header">
    <span class="slide-number">Slide ${num}</span>
    <span class="slide-title">${esc(title)}</span>
    ${slide.slideType ? `<span class="slide-type">${esc(slide.slideType.replace(/_/g, " "))}</span>` : ""}
  </div>
  <img class="slide-image" src="${imgSrc}" alt="${esc(title)}" />
  ${bullets.length ? `<ul class="slide-bullets">${bullets.map((b) => `<li>${esc(b)}</li>`).join("")}</ul>` : ""}
  <div class="slide-prompts">
    ${slide.teacherPrompt ? `<div class="prompt-row"><strong>👩‍🏫 Teacher Prompt:</strong> ${esc(slide.teacherPrompt)}</div>` : ""}
    ${slide.studentTask ? `<div class="prompt-row"><strong>🎒 Student Task:</strong> ${esc(slide.studentTask)}</div>` : ""}
    ${slide.interactivePrompt ? `<div class="prompt-row activity-row"><strong>🎯 Classroom Activity:</strong> ${esc(slide.interactivePrompt)}</div>` : ""}
  </div>
  <div class="video-link">
    🎥 <strong>Video Resource:</strong>
    <a href="${videoLink}" target="_blank">${esc(slide.videoQuery || title)}</a>
    <span class="video-url-print">${videoLink}</span>
  </div>
</div>`;
      });
      slidesSection = `<div class="content-section">${slidesHTML}</div><div class="page-break"></div>`;
    }

    // ── Video Resources (consolidated list) ───────────────────────────────────
    let videoSection = "";
    const videoSlides = slidesData.filter((s) => s.videoQuery || s.title);
    if (videoSlides.length) {
      let videoHTML = sectionHeader("Video Resources", "🎥");
      videoHTML += `<p class="video-intro">Use these YouTube search links to find relevant videos for each slide. Links work when online; the search terms are printed below for offline reference.</p>`;
      videoHTML += `<table class="video-table"><thead><tr><th>#</th><th>Slide Title</th><th>Search Term</th><th>Link</th></tr></thead><tbody>`;
      videoSlides.forEach((slide, i) => {
        const num = slide.slideNumber ?? i + 1;
        const title = slide.title || `Slide ${num}`;
        const query = slide.videoQuery || title;
        const link = youtubeSearchUrl(query);
        videoHTML += `<tr>
          <td>${num}</td>
          <td>${esc(title)}</td>
          <td>${esc(query)}</td>
          <td><a href="${link}" target="_blank">Watch →</a><br><small class="video-url-print">${esc(link)}</small></td>
        </tr>`;
      });
      videoHTML += `</tbody></table>`;
      videoSection = `<div class="content-section">${videoHTML}</div><div class="page-break"></div>`;
    }

    // ── MCQs ──────────────────────────────────────────────────────────────────
    let mcqSection = "";
    if (mcqData.length) {
      let mcqHTML = sectionHeader("Multiple Choice Questions", "📝");
      mcqHTML += `<div class="mcq-list">`;
      mcqData.forEach((q, i) => {
        const options = Array.isArray(q.options) ? q.options : [];
        const answerLetter = typeof q.answerIndex === "number"
          ? String.fromCharCode(65 + q.answerIndex) : null;
        mcqHTML += `<div class="mcq-item">
          <div class="mcq-question"><strong>${i + 1}.</strong> ${esc(q.q ?? "Question")}</div>
          <div class="mcq-options">
            ${options.map((opt, j) => `<div class="mcq-option ${j === q.answerIndex ? "correct-option" : ""}">
              <span class="option-letter">${String.fromCharCode(65 + j)}.</span> ${esc(opt)}
            </div>`).join("")}
          </div>
          ${answerLetter ? `<div class="mcq-answer">✅ Answer: <strong>${answerLetter}</strong></div>` : ""}
          ${q.explanation ? `<div class="mcq-explanation"><strong>Explanation:</strong> ${esc(q.explanation)}</div>` : ""}
        </div>`;
      });
      mcqHTML += `</div>`;
      mcqSection = `<div class="content-section">${mcqHTML}</div><div class="page-break"></div>`;
    }

    // ── Theory Questions ──────────────────────────────────────────────────────
    let theorySection = "";
    if (theoryData.length) {
      let theoryHTML = sectionHeader("Theory Questions", "✍️");
      theoryHTML += `<ol class="theory-list">`;
      theoryData.forEach((q) => {
        theoryHTML += `<li class="theory-item">
          <div class="theory-question">${esc(q.question ?? q.q ?? "Question")}</div>
          ${q.markingGuide ? `<div class="marking-guide"><strong>Marking Guide:</strong> ${esc(q.markingGuide)}</div>` : ""}
          <div class="answer-space"></div>
        </li>`;
      });
      theoryHTML += `</ol>`;
      theorySection = `<div class="content-section">${theoryHTML}</div><div class="page-break"></div>`;
    }

    // ── References ────────────────────────────────────────────────────────────
    let referencesSection = "";
    if (Array.isArray(result.references) && result.references.length) {
      let refsHTML = sectionHeader("References", "📖");
      refsHTML += listBlock(result.references, true);
      referencesSection = `<div class="content-section">${refsHTML}</div>`;
    }

    // ── Live Applications ─────────────────────────────────────────────────────
    let liveAppsSection = "";
    if (liveApps.length) {
      let liveHTML = sectionHeader("Live / Real-World Applications", "🌍");
      liveHTML += listBlock(liveApps);
      liveAppsSection = `<div class="content-section">${liveHTML}</div><div class="page-break"></div>`;
    }

    // ── Full HTML document ────────────────────────────────────────────────────
    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>LessonForge — ${esc(subjectLabel)} — ${esc(topicLabel)}</title>
  <style>
    /* ─── Reset & Base ─────────────────────────────────────────── */
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    html { font-size: 15px; }
    body {
      font-family: Georgia, "Times New Roman", serif;
      color: #1e293b;
      background: #ffffff;
      line-height: 1.7;
    }
    a { color: #5b4fcf; }
    strong { font-weight: 700; }

    /* ─── Layout ───────────────────────────────────────────────── */
    .page-wrap { max-width: 860px; margin: 0 auto; padding: 32px 24px; }
    .page-break { page-break-after: always; margin: 40px 0; border-top: 2px dashed #e2e8f0; }

    /* ─── Cover Page ───────────────────────────────────────────── */
    .cover-page {
      min-height: 80vh;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      text-align: center;
      padding: 48px 32px;
      background: linear-gradient(135deg, #f8f7ff 0%, #ffffff 60%, #f0f4ff 100%);
      border-radius: 16px;
      border: 2px solid #e0dff8;
    }
    .cover-logo {
      font-family: Arial, sans-serif;
      font-size: 13px;
      font-weight: 800;
      letter-spacing: 0.15em;
      text-transform: uppercase;
      color: #5b4fcf;
      background: #ede9ff;
      padding: 6px 18px;
      border-radius: 999px;
      margin-bottom: 20px;
    }
    .cover-badge {
      font-size: 12px;
      font-weight: 700;
      letter-spacing: 0.1em;
      text-transform: uppercase;
      color: #8b5cf6;
      margin-bottom: 16px;
    }
    .cover-title {
      font-size: 2.4rem;
      font-weight: 800;
      color: #1e1b4b;
      line-height: 1.2;
      margin-bottom: 12px;
    }
    .cover-subject {
      font-size: 1.1rem;
      color: #5b4fcf;
      font-weight: 600;
      margin-bottom: 32px;
    }
    .info-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
      gap: 12px;
      width: 100%;
      max-width: 600px;
      margin: 0 auto;
    }
    .info-item {
      background: #fff;
      border: 1px solid #e0dff8;
      border-radius: 10px;
      padding: 10px 14px;
      text-align: left;
    }
    .info-label {
      display: block;
      font-size: 10px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      color: #8b5cf6;
      margin-bottom: 2px;
      font-family: Arial, sans-serif;
    }
    .info-value {
      font-size: 13px;
      font-weight: 700;
      color: #1e293b;
      font-family: Arial, sans-serif;
    }

    /* ─── TOC ──────────────────────────────────────────────────── */
    .toc-page { padding: 24px 0; }
    .toc-list {
      list-style: decimal;
      padding-left: 24px;
      font-family: Arial, sans-serif;
    }
    .toc-list li {
      padding: 6px 0;
      font-size: 14px;
      font-weight: 600;
      color: #334155;
      border-bottom: 1px dotted #e2e8f0;
    }

    /* ─── Section Header ───────────────────────────────────────── */
    .section-header {
      background: linear-gradient(90deg, #5b4fcf 0%, #7c3aed 100%);
      color: #fff;
      padding: 14px 20px;
      border-radius: 10px;
      margin-bottom: 24px;
    }
    .section-header h2 {
      font-size: 1.25rem;
      font-weight: 800;
      font-family: Arial, sans-serif;
      letter-spacing: -0.01em;
    }

    /* ─── Content Section ──────────────────────────────────────── */
    .content-section { padding: 8px 0 24px; }

    /* ─── Field Blocks ─────────────────────────────────────────── */
    .field-block { margin-bottom: 20px; }
    .field-label {
      font-size: 11px;
      font-weight: 800;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      color: #5b4fcf;
      font-family: Arial, sans-serif;
      margin-bottom: 6px;
      padding-bottom: 4px;
      border-bottom: 2px solid #ede9ff;
    }
    .field-content { font-size: 14px; }

    /* ─── Lists ────────────────────────────────────────────────── */
    .content-list {
      padding-left: 22px;
      space-y: 4px;
    }
    .content-list li {
      margin-bottom: 6px;
      font-size: 14px;
      line-height: 1.6;
    }

    /* ─── Vocabulary Table ─────────────────────────────────────── */
    .vocab-table {
      width: 100%;
      border-collapse: collapse;
      font-size: 13px;
      font-family: Arial, sans-serif;
    }
    .vocab-table th {
      background: #5b4fcf;
      color: #fff;
      padding: 8px 12px;
      text-align: left;
      font-weight: 700;
    }
    .vocab-table td { padding: 7px 12px; border-bottom: 1px solid #e2e8f0; }
    .vocab-table tr:nth-child(even) td { background: #f8f7ff; }

    /* ─── Step Cards ───────────────────────────────────────────── */
    .step-card {
      border: 1px solid #e0dff8;
      border-left: 4px solid #5b4fcf;
      border-radius: 8px;
      padding: 14px 16px;
      margin-bottom: 14px;
      background: #fafaff;
    }
    .step-title {
      font-weight: 800;
      font-size: 14px;
      color: #1e1b4b;
      margin-bottom: 10px;
      font-family: Arial, sans-serif;
    }
    .step-row {
      font-size: 13px;
      margin-bottom: 6px;
      padding-left: 6px;
    }
    .step-key { font-weight: 700; color: #334155; }

    /* ─── Differentiation Blocks ───────────────────────────────── */
    .diff-block {
      padding: 10px 14px;
      border-radius: 8px;
      margin-bottom: 8px;
      font-size: 13px;
    }
    .diff-support { background: #fefce8; border: 1px solid #fde68a; }
    .diff-average { background: #eff6ff; border: 1px solid #bfdbfe; }
    .diff-advanced { background: #f0fdf4; border: 1px solid #bbf7d0; }

    /* ─── Marking Guide ────────────────────────────────────────── */
    .marking-guide {
      margin-top: 6px;
      padding: 6px 10px;
      background: #f8f7ff;
      border-left: 3px solid #8b5cf6;
      font-size: 12px;
      color: #475569;
      border-radius: 0 6px 6px 0;
    }

    /* ─── Concept Cards ────────────────────────────────────────── */
    .concept-card {
      border-left: 3px solid #8b5cf6;
      padding: 10px 14px;
      margin-bottom: 12px;
      background: #fafaff;
      border-radius: 0 8px 8px 0;
    }
    .concept-heading {
      font-weight: 800;
      font-size: 13px;
      color: #1e1b4b;
      margin-bottom: 4px;
      font-family: Arial, sans-serif;
    }

    /* ─── Worked Example Cards ─────────────────────────────────── */
    .example-card {
      border: 1px solid #e2e8f0;
      border-radius: 10px;
      padding: 16px;
      margin-bottom: 16px;
      background: #fff;
    }
    .example-title {
      font-weight: 800;
      font-size: 14px;
      color: #1e1b4b;
      margin-bottom: 10px;
      padding-bottom: 6px;
      border-bottom: 1px solid #e2e8f0;
      font-family: Arial, sans-serif;
    }
    .example-steps { margin: 8px 0; }
    .final-answer {
      background: #f0fdf4;
      border: 1px solid #bbf7d0;
      border-radius: 6px;
      padding: 8px 12px;
      margin-top: 8px;
    }

    /* ─── Slide Cards ──────────────────────────────────────────── */
    .slide-card {
      border: 2px solid #e0dff8;
      border-radius: 14px;
      overflow: hidden;
      margin-bottom: 28px;
      background: #fff;
      page-break-inside: avoid;
    }
    .slide-header {
      background: #1e1b4b;
      color: #fff;
      padding: 12px 16px;
      display: flex;
      align-items: center;
      gap: 10px;
      font-family: Arial, sans-serif;
    }
    .slide-number {
      background: #5b4fcf;
      color: #fff;
      font-size: 11px;
      font-weight: 800;
      padding: 3px 10px;
      border-radius: 999px;
      letter-spacing: 0.05em;
    }
    .slide-title {
      font-size: 15px;
      font-weight: 700;
      flex: 1;
    }
    .slide-type {
      font-size: 10px;
      text-transform: uppercase;
      letter-spacing: 0.1em;
      color: #a5b4fc;
    }
    .slide-image {
      width: 100%;
      height: 220px;
      object-fit: cover;
      display: block;
      border-bottom: 1px solid #e0dff8;
    }
    .slide-bullets {
      padding: 14px 14px 14px 32px;
      font-size: 14px;
      font-weight: 600;
      color: #1e293b;
    }
    .slide-bullets li { margin-bottom: 6px; }
    .slide-prompts {
      padding: 12px 16px;
      background: #f8f7ff;
      border-top: 1px solid #e0dff8;
      font-size: 13px;
    }
    .prompt-row { margin-bottom: 6px; line-height: 1.5; }
    .activity-row {
      margin-top: 8px;
      padding: 8px 12px;
      background: #fefce8;
      border-radius: 8px;
      border: 1px solid #fde68a;
    }
    .video-link {
      padding: 10px 16px;
      background: #eff6ff;
      border-top: 1px solid #bfdbfe;
      font-size: 13px;
    }
    .video-url-print {
      display: block;
      font-size: 10px;
      color: #64748b;
      word-break: break-all;
      margin-top: 2px;
    }

    /* ─── Video Table ──────────────────────────────────────────── */
    .video-intro { font-size: 13px; color: #475569; margin-bottom: 16px; }
    .video-table {
      width: 100%;
      border-collapse: collapse;
      font-size: 13px;
      font-family: Arial, sans-serif;
    }
    .video-table th {
      background: #1e1b4b;
      color: #fff;
      padding: 10px 12px;
      text-align: left;
      font-weight: 700;
    }
    .video-table td {
      padding: 9px 12px;
      border-bottom: 1px solid #e2e8f0;
      vertical-align: top;
    }
    .video-table tr:nth-child(even) td { background: #f8f7ff; }

    /* ─── MCQ ──────────────────────────────────────────────────── */
    .mcq-list { display: flex; flex-direction: column; gap: 20px; }
    .mcq-item {
      border: 1px solid #e2e8f0;
      border-radius: 10px;
      padding: 16px;
      background: #fff;
      page-break-inside: avoid;
    }
    .mcq-question {
      font-size: 14px;
      font-weight: 700;
      color: #1e293b;
      margin-bottom: 12px;
      line-height: 1.5;
    }
    .mcq-options { display: flex; flex-direction: column; gap: 6px; margin-bottom: 10px; }
    .mcq-option {
      display: flex;
      gap: 8px;
      font-size: 13px;
      padding: 6px 10px;
      border-radius: 6px;
      background: #f8fafc;
      border: 1px solid #e2e8f0;
    }
    .correct-option {
      background: #f0fdf4;
      border-color: #86efac;
      font-weight: 600;
    }
    .option-letter { font-weight: 800; color: #5b4fcf; min-width: 18px; }
    .mcq-answer {
      font-size: 13px;
      font-weight: 700;
      color: #16a34a;
      background: #f0fdf4;
      padding: 6px 12px;
      border-radius: 6px;
      display: inline-block;
    }
    .mcq-explanation {
      margin-top: 8px;
      font-size: 12px;
      color: #475569;
      background: #f8f7ff;
      padding: 8px 12px;
      border-radius: 6px;
      border-left: 3px solid #8b5cf6;
    }

    /* ─── Theory Questions ─────────────────────────────────────── */
    .theory-list { padding-left: 20px; }
    .theory-item {
      margin-bottom: 24px;
      page-break-inside: avoid;
    }
    .theory-question {
      font-size: 14px;
      font-weight: 700;
      color: #1e293b;
      margin-bottom: 8px;
    }
    .answer-space {
      min-height: 80px;
      border: 1px dashed #cbd5e1;
      border-radius: 8px;
      margin-top: 10px;
      background: #fafafa;
    }

    /* ─── Footer ───────────────────────────────────────────────── */
    .doc-footer {
      text-align: center;
      padding: 24px 0 8px;
      font-size: 11px;
      color: #94a3b8;
      border-top: 1px solid #e2e8f0;
      font-family: Arial, sans-serif;
    }

    /* ─── Print Styles ─────────────────────────────────────────── */
    @media print {
      body { font-size: 12px; }
      .page-break { page-break-after: always; }
      .slide-card, .mcq-item, .theory-item { page-break-inside: avoid; }
      .video-url-print { display: block !important; }
      a { color: #1e1b4b; text-decoration: none; }
    }
  </style>
</head>
<body>
<div class="page-wrap">
  ${coverHTML}
  ${tocHTML}
  ${lessonPlanSection}
  ${lessonNotesSection}
  ${slidesSection}
  ${videoSection}
  ${mcqSection}
  ${theorySection}
  ${liveAppsSection}
  ${referencesSection}
  <div class="doc-footer">
    Generated with LessonForge &nbsp;•&nbsp; ${esc(generatedDate)} &nbsp;•&nbsp;
    ${esc(subjectLabel)} — ${esc(topicLabel)} — ${esc(gradeLabel)}
    ${age ? ` &nbsp;•&nbsp; Age: ${esc(age)}` : ""}
  </div>
</div>
</body>
</html>`;
  }

  // ─── Download handler ─────────────────────────────────────────────────────
  async function handleDownloadCompletePack() {
    if (!result || downloadingPack) return;
    setDownloadingPack(true);
    try {
      const html = await buildCompletePackHTML();
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

              {saving ? (
                <span className="text-sm text-slate-700">Saving to Library…</span>
              ) : saveMsg ? (
                <span className="text-sm text-emerald-700">{saveMsg}</span>
              ) : null}

              {error ? <span className="text-sm text-red-600">{error}</span> : null}
            </div>
          </>
        )}

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
          {/* ── Header card + Download Complete Pack button ── */}
          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
              <div>
                <div className="text-xs text-slate-500">Topic</div>
                <div className="mt-1 text-xl font-bold text-slate-900">
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

                        {step.guidedQuestions?.length ? (
                          <div className="text-sm text-slate-700">
                            <div className="font-semibold">Guided Questions:</div>
                            <ul className="mt-1 list-disc pl-6 space-y-1">
                              {step.guidedQuestions.map((question, j) => (
                                <li key={j}>{question}</li>
                              ))}
                            </ul>
                          </div>
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

          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm space-y-4">
            <h3 className="text-xl font-extrabold text-slate-900 tracking-tight">
              Lesson Notes
            </h3>
            {result.lessonNotes ? (
              typeof result.lessonNotes === "string" ? (
                <p className="whitespace-pre-wrap text-sm text-slate-700 leading-relaxed">
                  {result.lessonNotes}
                </p>
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
                        {result.lessonNotes.keyConcepts.map((concept, i) => (
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
                        {result.lessonNotes.workedExamples.map((example, i) => (
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
                                  {example.steps.map((step, j) => (
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
                        {result.lessonNotes.summaryPoints.map((point, i) => (
                          <li key={i}>{point}</li>
                        ))}
                      </ul>
                    </div>
                  ) : null}
                  {result.lessonNotes.keyVocabulary?.length ? (
                    <div>
                      <p className="text-sm font-semibold text-slate-800">Key Vocabulary</p>
                      <div className="mt-2 space-y-2">
                        {result.lessonNotes.keyVocabulary.map((item, i) => (
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

                  {result.lessonNotes.realLifeApplications?.length ? (
                    <div>
                      <p className="text-sm font-semibold text-slate-800">
                        Real-Life Applications
                      </p>
                      <ul className="mt-2 list-disc pl-6 space-y-2 text-sm text-slate-700">
                        {result.lessonNotes.realLifeApplications.map((item, i) => (
                          <li key={i}>{item}</li>
                        ))}
                      </ul>
                    </div>
                  ) : null}

                  {result.lessonNotes.exitTicket?.length ? (
                    <div>
                      <p className="text-sm font-semibold text-slate-800">Exit Ticket</p>
                      <ul className="mt-2 list-disc pl-6 space-y-2 text-sm text-slate-700">
                        {result.lessonNotes.exitTicket.map((item, i) => (
                          <li key={i}>{item}</li>
                        ))}
                      </ul>
                    </div>
                  ) : null}
                </div>
              )
            ) : (
              <p className="text-sm text-slate-500">No lesson notes generated.</p>
            )}
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
                      className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm space-y-4"
                    >
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <div className="text-lg font-bold text-slate-900">
                            {slideNumber}. {title}
                          </div>
                          {slideType ? (
                            <div className="text-xs uppercase text-slate-500">
                              {slideType}
                            </div>
                          ) : null}
                        </div>
                        <span className="text-[11px] font-semibold px-2 py-1 rounded-full border bg-slate-50 text-slate-700">
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

                      <div className="space-y-3 rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-900">
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

                      {q?.explanation ? (
                        <div className="mt-3 p-3 bg-slate-50 rounded-lg border border-slate-200">
                          <p className="text-xs font-semibold text-slate-700 mb-1">
                            Explanation:
                          </p>
                          <p className="text-sm text-slate-600">{q.explanation}</p>
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
