import OpenAI from "openai";
import { NextRequest, NextResponse } from "next/server";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import {
  consumeGenerationCredits,
  consumePersonalCreditsDirectly,
  getGenerationCreditAvailability,
} from "@/lib/credits/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const LESSON_PACK_CREDIT_COST = 4;

type ExamAlignment = "None" | "WAEC" | "NECO";
type SchoolLevel = "EYFS" | "Primary" | "Secondary";

export type GenerationMetadata = {
  subject: string;
  topic: string;
  grade: string;
  curriculum: string;
  examAlignment: ExamAlignment;
  examBoard: ExamAlignment;
  schoolLevel: SchoolLevel;
  numberOfSlides: number;
  durationMins: number;
  age?: string;
  usePersonalCredits?: boolean;
};

type AuthedContext =
  | { ok: true; supabase: SupabaseClient; userId: string }
  | { ok: false; response: NextResponse };

type StagePayload = {
  lessonId?: string;
  generationMeta?: Partial<GenerationMetadata>;
  metadata?: Partial<GenerationMetadata>;
} & Partial<GenerationMetadata>;

type JsonRecord = Record<string, any>;

type PexelsPhoto = {
  src?: {
    large2x?: string;
    large?: string;
    medium?: string;
  };
  photographer?: string;
  alt?: string;
};

type PexelsResponse = {
  photos?: PexelsPhoto[];
};

function clampNumber(value: unknown, min: number, max: number, fallback: number) {
  const num = typeof value === "number" ? value : typeof value === "string" ? Number(value) : NaN;
  if (!Number.isFinite(num)) return fallback;
  return Math.max(min, Math.min(max, num));
}

function cleanString(value: unknown, fallback = "") {
  return typeof value === "string" ? value.trim() || fallback : fallback;
}

function cleanEnum<T extends string>(value: unknown, allowed: readonly T[], fallback: T): T {
  return typeof value === "string" && allowed.includes(value.trim() as T)
    ? (value.trim() as T)
    : fallback;
}

export async function getAuthedContext(req: NextRequest): Promise<AuthedContext> {
  const auth = req.headers.get("authorization") ?? "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";

  if (!token) {
    return {
      ok: false,
      response: NextResponse.json({ ok: false, error: "Unauthorized (no token)" }, { status: 401 }),
    };
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
      global: { headers: { Authorization: `Bearer ${token}` } },
    }
  );

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    return {
      ok: false,
      response: NextResponse.json(
        { ok: false, error: "Unauthorized (invalid token)", message: error?.message },
        { status: 401 }
      ),
    };
  }

  return { ok: true, supabase, userId: user.id };
}

export async function readJsonBody(req: NextRequest): Promise<StagePayload | NextResponse> {
  try {
    return (await req.json()) as StagePayload;
  } catch {
    return NextResponse.json({ ok: false, error: "invalid_json", message: "Invalid JSON body." }, { status: 400 });
  }
}

export function normalizeGenerationMeta(input: Partial<GenerationMetadata>): GenerationMetadata {
  const examAlignment = cleanEnum(input.examAlignment ?? input.examBoard, ["None", "WAEC", "NECO"] as const, "None");
  return {
    subject: cleanString(input.subject),
    topic: cleanString(input.topic),
    grade: cleanString(input.grade),
    curriculum: cleanString(input.curriculum, "Nigerian Curriculum"),
    examAlignment,
    examBoard: examAlignment,
    schoolLevel: cleanEnum(input.schoolLevel, ["EYFS", "Primary", "Secondary"] as const, "Secondary"),
    numberOfSlides: clampNumber(input.numberOfSlides, 1, 20, 8),
    durationMins: clampNumber(input.durationMins, 10, 180, 40),
    age: cleanString(input.age),
    usePersonalCredits: input.usePersonalCredits === true,
  };
}

export function mergeIncomingMeta(body: StagePayload, savedData?: JsonRecord): GenerationMetadata {
  const savedMeta = savedData?.meta?.generationMeta ?? {};
  return normalizeGenerationMeta({
    ...body,
    ...(body.metadata ?? {}),
    ...(body.generationMeta ?? {}),
    ...savedMeta,
  });
}

export function validateRequiredGenerationMeta(meta: GenerationMetadata): string | null {
  if (!meta.subject) return "Missing subject.";
  if (!meta.topic) return "Missing topic.";
  if (!meta.grade) return "Missing grade.";
  return null;
}

function baseMeta(meta: GenerationMetadata) {
  return {
    subject: meta.subject,
    topic: meta.topic,
    grade: meta.grade,
    curriculum: meta.curriculum,
    examAlignment: meta.examAlignment,
    schoolLevel: meta.schoolLevel,
    numberOfSlides: meta.numberOfSlides,
    durationMins: meta.durationMins,
    lessonType: "mixed",
    academicDepth: meta.schoolLevel === "EYFS" ? "foundational" : "standard",
    stage: 1,
    generationMeta: meta,
  };
}

export function emptyLessonData(meta: GenerationMetadata) {
  return {
    meta: baseMeta(meta),
    lessonPlan: {
      lessonTitle: "",
      performanceObjectives: [],
      successCriteria: [],
      previousKnowledge: "",
      instructionalMaterials: [],
      lifeNatureActivities: [],
      crossCurricularActivities: [],
      keyVocabulary: [],
      commonMisconceptions: [],
      introduction: "",
      steps: [],
      differentiation: {
        supportForStrugglingLearners: "",
        supportForAverageLearners: "",
        challengeForAdvancedLearners: "",
      },
      realLifeApplications: [],
      boardSummary: [],
      evaluation: [],
      exitTicket: [],
      assignment: [],
    },
    lessonNotes: {
      introduction: "",
      keyConcepts: [],
      workedExamples: [],
      realLifeApplications: [],
      summaryPoints: [],
      exitTicket: [],
      keyVocabulary: [],
    },
    subjectEnrichment: {
      isCalculationBased: false,
      coreFormulas: [],
      symbolsAndUnits: [],
      calculationRules: [],
      extraWorkedExamples: [],
      commonCalculationMistakes: [],
    },
    references: [],
    slides: [],
    quiz: { mcq: [], theory: [] },
    liveApplications: [],
  };
}

function normalizeStringArray(value: unknown, fallback: string[] = []) {
  return Array.isArray(value)
    ? value.map((item) => (typeof item === "string" ? item.trim() : "")).filter(Boolean)
    : fallback;
}

function normalizeObjectArray(value: unknown) {
  return Array.isArray(value) ? value.filter((item) => item && typeof item === "object") : [];
}

const GENERIC_IMAGE_QUERY_TERMS = new Set([
  "book",
  "books",
  "library",
  "education",
  "educational",
  "learning",
  "lesson",
  "school",
  "student",
  "students",
  "teacher",
  "teachers",
  "classroom",
  "study",
  "studying",
  "background",
  "abstract",
  "stock",
]);

function queryWords(value: unknown): string[] {
  return String(value ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, " ")
    .split(/\s+/)
    .map((word) => word.trim())
    .filter((word) => word.length > 2);
}

function compactImageQuery(parts: unknown[], maxWords = 10) {
  const seen = new Set<string>();
  const words: string[] = [];

  for (const part of parts) {
    for (const word of queryWords(part)) {
      if (GENERIC_IMAGE_QUERY_TERMS.has(word)) continue;
      if (seen.has(word)) continue;
      seen.add(word);
      words.push(word);
      if (words.length >= maxWords) return words.join(" ");
    }
  }

  return words.join(" ");
}

function subjectVisualContext(subject: string) {
  const s = subject.toLowerCase();
  if (s.includes("biology")) return "biology specimen leaf organism";
  if (s.includes("physics")) return "physics apparatus experiment force";
  if (s.includes("chemistry")) return "chemistry laboratory apparatus reaction";
  if (s.includes("geography")) return "geography map landform environment";
  if (s.includes("economics")) return "market prices chart demand supply";
  if (s.includes("commerce") || s.includes("business")) return "trade market finance transaction";
  if (s.includes("math")) return "mathematics graph number diagram";
  if (s.includes("computer") || s.includes("ict")) return "computer technology coding network";
  if (s.includes("agric")) return "agriculture crops soil farming";
  if (s.includes("literature") || s.includes("english")) return "literature text language passage";
  if (s.includes("civic") || s.includes("government")) return "community leadership citizenship culture";
  if (s.includes("history")) return "historical scene culture people";
  return subject;
}

function localVisualContext(meta: GenerationMetadata) {
  const haystack = `${meta.curriculum} ${meta.examAlignment} ${meta.subject} ${meta.topic}`.toLowerCase();
  if (
    haystack.includes("nigeria") ||
    haystack.includes("nigerian") ||
    haystack.includes("waec") ||
    haystack.includes("neco")
  ) {
    return "Nigeria African";
  }
  if (haystack.includes("africa") || haystack.includes("african")) return "African";
  return "";
}

function slideVisualMode(slideType: string) {
  const type = slideType.toLowerCase();
  if (type.includes("worked")) return "diagram step example";
  if (type.includes("vocabulary")) return "single object example";
  if (type.includes("concept")) return "real world representation";
  if (type.includes("quick") || type.includes("check")) return "clear comparison visual";
  if (type.includes("activity") || type.includes("discussion")) return "real classroom scenario";
  return "specific lesson visual";
}

function hasGenericVisualText(value: string) {
  const normalized = value.toLowerCase();
  return (
    normalized.includes("books") ||
    normalized.includes("library") ||
    normalized.includes("students learning") ||
    normalized.includes("teacher teaching") ||
    normalized.includes("study materials") ||
    normalized.includes("abstract background") ||
    normalized === "classroom" ||
    normalized === "education"
  );
}

function isPexelsImageUrl(value: unknown) {
  if (typeof value !== "string") return false;
  try {
    const hostname = new URL(value).hostname.toLowerCase();
    return hostname === "images.pexels.com" || hostname.endsWith(".pexels.com");
  } catch {
    return false;
  }
}

function cleanPexelsQuery(query: unknown) {
  const cleaned = cleanString(query)
    .replace(/classroom-?safe|classroom-?friendly|educational style/gi, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 100);

  if (!cleaned || hasGenericVisualText(cleaned)) return "";
  return cleaned;
}

function getSlideImageQuery(slide: JsonRecord) {
  const candidates = [
    slide.image_query,
    slide.imageQuery,
    slide.visual_suggestion,
    slide.visualSuggestion,
    slide.title,
  ];

  for (const candidate of candidates) {
    const cleaned = cleanPexelsQuery(candidate);
    if (cleaned) return cleaned;
  }

  return "";
}

async function fetchPexelsImage(query: string, apiKey: string, timeoutMs: number) {
  const cleanQuery = cleanPexelsQuery(query);
  if (!cleanQuery || !apiKey) return null;

  try {
    const url = `https://api.pexels.com/v1/search?query=${encodeURIComponent(cleanQuery)}&per_page=1&orientation=landscape&size=large`;
    const res = await fetch(url, {
      headers: { Authorization: apiKey },
      signal: AbortSignal.timeout(timeoutMs),
    });

    if (!res.ok) return null;

    const data = (await res.json()) as PexelsResponse;
    const pick = Array.isArray(data.photos) ? data.photos[0] : null;
    const imageUrl = pick?.src?.large2x ?? pick?.src?.large ?? pick?.src?.medium ?? null;
    if (!isPexelsImageUrl(imageUrl)) return null;

    return {
      image_url: imageUrl,
      image_credit: pick?.photographer ?? "Pexels",
      image_alt: pick?.alt ?? cleanQuery,
    };
  } catch {
    return null;
  }
}

export async function enrichSlidesWithPexelsImages(
  slides: JsonRecord[],
  pexelsKey: string,
  options: { timeoutMs?: number; overallTimeoutMs?: number } = {}
) {
  if (!pexelsKey || !Array.isArray(slides) || slides.length === 0) return slides;

  const timeoutMs = Math.max(500, options.timeoutMs ?? 2500);
  const overallTimeoutMs = Math.max(timeoutMs, options.overallTimeoutMs ?? 4500);

  const work = Promise.allSettled(
    slides.map(async (slide) => {
      const image = await fetchPexelsImage(getSlideImageQuery(slide), pexelsKey, timeoutMs);
      return image
        ? {
            ...slide,
            ...image,
          }
        : slide;
    })
  ).then((results) =>
    results.map((result, index) =>
      result.status === "fulfilled" ? result.value : slides[index]
    )
  );

  const timeout = new Promise<JsonRecord[]>((resolve) => {
    setTimeout(() => resolve(slides), overallTimeoutMs);
  });

  return Promise.race([work, timeout]);
}

function refineSlideImageText(slide: JsonRecord, meta: GenerationMetadata) {
  const slideType = cleanString(slide.slideType, "concept");
  const bullets = normalizeStringArray(slide.bullets).slice(0, 2).join(" ");
  const baseQuery = compactImageQuery(
    [
      meta.topic,
      meta.subject,
      slide.title,
      slide.imageQuery,
      slide.image_query,
      slide.visual_suggestion,
      bullets,
      subjectVisualContext(meta.subject),
      localVisualContext(meta),
      meta.schoolLevel,
      meta.grade,
      slideVisualMode(slideType),
    ],
    10
  );

  const imageQuery =
    baseQuery ||
    compactImageQuery([meta.topic, meta.subject, subjectVisualContext(meta.subject), localVisualContext(meta), slideVisualMode(slideType)]);

  const visualSuggestion = cleanString(
    slide.visual_suggestion ?? slide.visualSuggestion,
    `${slideVisualMode(slideType)} for ${meta.subject}: ${meta.topic}`
  );

  return {
    imageQuery,
    visualSuggestion: hasGenericVisualText(visualSuggestion) ? `${slideVisualMode(slideType)} for ${meta.subject}: ${imageQuery}` : visualSuggestion,
  };
}

export function normalizeStage1(raw: unknown, meta: GenerationMetadata) {
  const record = raw && typeof raw === "object" ? (raw as JsonRecord) : {};
  const base = emptyLessonData(meta);
  const rawMeta = record.meta && typeof record.meta === "object" ? record.meta : {};
  const lessonPlan = record.lessonPlan && typeof record.lessonPlan === "object" ? record.lessonPlan : {};
  const lessonNotes = record.lessonNotes && typeof record.lessonNotes === "object" ? record.lessonNotes : {};
  const enrichment = record.subjectEnrichment && typeof record.subjectEnrichment === "object" ? record.subjectEnrichment : {};

  return {
    ...base,
    meta: {
      ...base.meta,
      ...rawMeta,
      subject: cleanString(rawMeta.subject, meta.subject),
      topic: cleanString(rawMeta.topic, meta.topic),
      grade: cleanString(rawMeta.grade, meta.grade),
      curriculum: cleanString(rawMeta.curriculum, meta.curriculum),
      examAlignment: cleanEnum(rawMeta.examAlignment, ["None", "WAEC", "NECO"] as const, meta.examAlignment),
      schoolLevel: cleanEnum(rawMeta.schoolLevel, ["EYFS", "Primary", "Secondary"] as const, meta.schoolLevel),
      numberOfSlides: clampNumber(rawMeta.numberOfSlides, 1, 20, meta.numberOfSlides),
      durationMins: clampNumber(rawMeta.durationMins, 10, 180, meta.durationMins),
      generationMeta: meta,
      stage: 1,
    },
    lessonPlan: {
      ...base.lessonPlan,
      ...lessonPlan,
      lessonTitle: cleanString(lessonPlan.lessonTitle ?? lessonPlan.title, `${meta.subject} - ${meta.topic}`),
      performanceObjectives: normalizeStringArray(lessonPlan.performanceObjectives),
      successCriteria: normalizeStringArray(lessonPlan.successCriteria),
      instructionalMaterials: normalizeStringArray(lessonPlan.instructionalMaterials),
      lifeNatureActivities: normalizeStringArray(lessonPlan.lifeNatureActivities),
      crossCurricularActivities: normalizeStringArray(lessonPlan.crossCurricularActivities),
      keyVocabulary: normalizeObjectArray(lessonPlan.keyVocabulary),
      commonMisconceptions: normalizeStringArray(lessonPlan.commonMisconceptions),
      steps: normalizeObjectArray(lessonPlan.steps),
      realLifeApplications: normalizeStringArray(lessonPlan.realLifeApplications ?? lessonPlan.realLifeConnection),
      boardSummary: normalizeStringArray(lessonPlan.boardSummary),
      evaluation: normalizeObjectArray(lessonPlan.evaluation),
      exitTicket: normalizeStringArray(lessonPlan.exitTicket),
      assignment: normalizeStringArray(lessonPlan.assignment),
    },
    lessonNotes: {
      ...base.lessonNotes,
      ...lessonNotes,
      keyConcepts: normalizeObjectArray(lessonNotes.keyConcepts),
      workedExamples: normalizeObjectArray(lessonNotes.workedExamples),
      realLifeApplications: normalizeStringArray(lessonNotes.realLifeApplications),
      summaryPoints: normalizeStringArray(lessonNotes.summaryPoints),
      exitTicket: normalizeStringArray(lessonNotes.exitTicket),
      keyVocabulary: normalizeObjectArray(lessonNotes.keyVocabulary),
    },
    subjectEnrichment: {
      ...base.subjectEnrichment,
      ...enrichment,
      coreFormulas: normalizeObjectArray(enrichment.coreFormulas),
      symbolsAndUnits: normalizeObjectArray(enrichment.symbolsAndUnits),
      calculationRules: normalizeStringArray(enrichment.calculationRules),
      extraWorkedExamples: normalizeObjectArray(enrichment.extraWorkedExamples),
      commonCalculationMistakes: normalizeStringArray(enrichment.commonCalculationMistakes),
    },
    references: normalizeStringArray(record.references),
    liveApplications: normalizeStringArray(record.liveApplications),
  };
}

export function normalizeStage2(raw: unknown) {
  const record = raw && typeof raw === "object" ? (raw as JsonRecord) : {};
  const quiz = record.quiz && typeof record.quiz === "object" ? record.quiz : {};
  const enrichment = record.subjectEnrichment && typeof record.subjectEnrichment === "object" ? record.subjectEnrichment : {};
  const lessonPlan = record.lessonPlan && typeof record.lessonPlan === "object" ? record.lessonPlan : {};
  return {
    quiz: {
      mcq: normalizeObjectArray(quiz.mcq),
      theory: normalizeObjectArray(quiz.theory),
    },
    subjectEnrichment: {
      coreFormulas: normalizeObjectArray(enrichment.coreFormulas),
      symbolsAndUnits: normalizeObjectArray(enrichment.symbolsAndUnits),
      calculationRules: normalizeStringArray(enrichment.calculationRules),
      extraWorkedExamples: normalizeObjectArray(enrichment.extraWorkedExamples),
      commonCalculationMistakes: normalizeStringArray(enrichment.commonCalculationMistakes),
    },
    lessonPlan: {
      evaluation: normalizeObjectArray(lessonPlan.evaluation),
      exitTicket: normalizeStringArray(lessonPlan.exitTicket),
      assignment: normalizeStringArray(lessonPlan.assignment),
    },
  };
}

export function normalizeStage3(raw: unknown, meta: GenerationMetadata) {
  const record = raw && typeof raw === "object" ? (raw as JsonRecord) : {};
  const slides = normalizeObjectArray(record.slides).map((slide, index) => {
    const refinedVisual = refineSlideImageText(slide, meta);
    const imageQuery = refinedVisual.imageQuery;
    const videoQuery = cleanString(slide.videoQuery ?? slide.video_query);
    const visualSuggestion = refinedVisual.visualSuggestion;
    return {
      slideNumber: clampNumber(slide.slideNumber, 1, 999, index + 1),
      slideType: cleanString(slide.slideType, index === 0 ? "starter" : "concept"),
      title: cleanString(slide.title, `Slide ${index + 1}`),
      bullets: normalizeStringArray(slide.bullets).slice(0, 6),
      teacherPrompt: cleanString(slide.teacherPrompt),
      studentTask: cleanString(slide.studentTask),
      imageQuery,
      image_query: imageQuery,
      image_url: null,
      visual_suggestion: visualSuggestion,
      videoQuery,
      video_query: videoQuery,
      interactivePrompt: cleanString(slide.interactivePrompt),
    };
  });

  return { slides: slides.slice(0, meta.numberOfSlides) };
}

export function validateStage1(data: JsonRecord) {
  if (!data.lessonPlan?.lessonTitle) return "Missing lesson title.";
  if (!Array.isArray(data.lessonPlan?.performanceObjectives) || data.lessonPlan.performanceObjectives.length < 3) {
    return "Missing required performance objectives.";
  }
  if (!Array.isArray(data.lessonPlan?.steps) || data.lessonPlan.steps.length < 4) {
    return "Missing lesson delivery steps.";
  }
  if (!Array.isArray(data.lessonNotes?.keyConcepts) || data.lessonNotes.keyConcepts.length < 3) {
    return "Missing detailed lesson notes.";
  }
  if (!Array.isArray(data.references) || data.references.length < 3) return "Missing references.";
  return null;
}

export function validateStage2(data: ReturnType<typeof normalizeStage2>) {
  if (data.quiz.mcq.length !== 10) return "Stage 2 must include exactly 10 MCQ questions.";
  if (data.quiz.theory.length !== 2) return "Stage 2 must include exactly 2 theory questions.";
  if (data.lessonPlan.evaluation.length < 3) return "Stage 2 must include assessment/evaluation content.";
  return null;
}

export function validateStage3(data: ReturnType<typeof normalizeStage3>, meta: GenerationMetadata) {
  if (data.slides.length !== meta.numberOfSlides) {
    return `Stage 3 must include exactly ${meta.numberOfSlides} slides.`;
  }
  if (data.slides.some((slide) => !slide.title || slide.bullets.length < 4 || !slide.imageQuery || !slide.videoQuery)) {
    return "Each slide must include title, at least 4 bullets, image_query, visual_suggestion, and video_query.";
  }
  return null;
}

export async function parseOpenAiJson(resp: { output_text?: string | null }) {
  const raw = resp.output_text ?? "";
  try {
    return { ok: true as const, data: JSON.parse(raw) };
  } catch {
    return {
      ok: false as const,
      response: NextResponse.json(
        {
          ok: false,
          error: "openai_json_malformed",
          message: "OpenAI returned malformed JSON. No partial save was made for this stage.",
        },
        { status: 500 }
      ),
    };
  }
}

export function openAiClient() {
  if (!process.env.OPENAI_API_KEY) {
    return null;
  }
  return new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
}

export async function fetchOwnedLesson(supabase: SupabaseClient, lessonId: string, userId: string) {
  return supabase
    .from("lessons")
    .select("id, user_id, subject, topic, grade, curriculum, result_json")
    .eq("id", lessonId)
    .eq("user_id", userId)
    .maybeSingle();
}

export async function updateLessonResult(
  supabase: SupabaseClient,
  lessonId: string,
  userId: string,
  resultJson: JsonRecord
) {
  return supabase
    .from("lessons")
    .update({ result_json: resultJson })
    .eq("id", lessonId)
    .eq("user_id", userId)
    .select("id")
    .maybeSingle();
}

export async function checkCreditsOrResponse(
  supabase: SupabaseClient,
  userId: string,
  meta: GenerationMetadata
): Promise<NextResponse | null> {
  const availability = await getGenerationCreditAvailability(supabase, userId);
  if (!availability.ok) {
    return NextResponse.json(
      { ok: false, error: "credit_check_failed", message: availability.error },
      { status: 500 }
    );
  }

  if (!meta.usePersonalCredits && availability.creditsRemaining < LESSON_PACK_CREDIT_COST) {
    if (availability.source === "school") {
      const admin = createAdminClient();
      const { data: profile, error } = await admin
        .from("profiles")
        .select("credits_balance")
        .eq("id", userId)
        .maybeSingle();
      if (error) {
        return NextResponse.json(
          { ok: false, error: "credit_check_failed", message: `Credit check failed: ${error.message}` },
          { status: 500 }
        );
      }
      const personalCreditsAvailable = Math.max(0, Number((profile as JsonRecord | null)?.credits_balance ?? 0));
      if (personalCreditsAvailable >= LESSON_PACK_CREDIT_COST) {
        return NextResponse.json(
          {
            ok: false,
            errorCode: "needs_personal_confirmation",
            personalCreditsAvailable,
            cost: LESSON_PACK_CREDIT_COST,
            message: "Your school has run out of credits.",
          },
          { status: 402 }
        );
      }
      return NextResponse.json(
        {
          ok: false,
          error: "school_out_of_credits",
          errorCode: "school_out_of_credits",
          message: "Your school has used all its credits. Your principal has been notified and will add more credits soon.",
        },
        { status: 402 }
      );
    }

    return NextResponse.json(
      {
        ok: false,
        error: "out_of_credits",
        errorCode: "out_of_credits",
        message: "You have used all your credits. Purchase more to continue generating lessons.",
      },
      { status: 402 }
    );
  }

  return null;
}

export async function deductStage1CreditsOrCleanup(
  supabase: SupabaseClient,
  lessonId: string,
  userId: string,
  usePersonalCredits: boolean
): Promise<NextResponse | null> {
  const deductionResult = usePersonalCredits
    ? await consumePersonalCreditsDirectly(supabase, userId, LESSON_PACK_CREDIT_COST)
    : await consumeGenerationCredits(supabase, userId, LESSON_PACK_CREDIT_COST);

  if (deductionResult.ok) return null;

  console.error("[generate:stage1] Credit deduction failed:", {
    userId,
    lessonId,
    cost: LESSON_PACK_CREDIT_COST,
    source: deductionResult.source,
    errorCode: deductionResult.errorCode,
    error: deductionResult.error,
  });

  const { error: cleanupErr } = await createAdminClient()
    .from("lessons")
    .delete()
    .eq("id", lessonId)
    .eq("user_id", userId);

  if (cleanupErr) {
    console.error("[generate:stage1] Failed to clean up unpaid lesson:", cleanupErr.message);
  }

  if (deductionResult.errorCode === "needs_personal_confirmation") {
    return NextResponse.json(
      {
        ok: false,
        errorCode: "needs_personal_confirmation",
        personalCreditsAvailable: deductionResult.personalCreditsAvailable,
        cost: LESSON_PACK_CREDIT_COST,
        message: "Your school has run out of credits.",
        saved: false,
      },
      { status: 402 }
    );
  }

  if (deductionResult.errorCode === "out_of_credits" || deductionResult.errorCode === "school_out_of_credits") {
    return NextResponse.json(
      {
        ok: false,
        error: deductionResult.errorCode,
        errorCode: deductionResult.errorCode,
        message: deductionResult.error,
        saved: false,
      },
      { status: 402 }
    );
  }

  return NextResponse.json(
    {
      ok: false,
      error: "credit_deduction_failed",
      errorCode: "credit_deduction_failed",
      message: "The lesson was generated but credits could not be safely deducted, so it was not saved. Please retry.",
      detail: deductionResult.error,
      saved: false,
    },
    { status: 500 }
  );
}

function audience(meta: GenerationMetadata) {
  return [
    `School Level: ${meta.schoolLevel}`,
    `Class / Grade: ${meta.grade}`,
    meta.age ? `Age / Age Group: ${meta.age}` : "",
    `Subject: ${meta.subject}`,
    `Topic: ${meta.topic}`,
    `Curriculum: ${meta.curriculum}`,
    `Exam Alignment: ${meta.examAlignment}`,
    `Duration: ${meta.durationMins} minutes`,
    `Number of Slides: ${meta.numberOfSlides}`,
  ]
    .filter(Boolean)
    .join("\n- ");
}

const qualityRules = `
Quality rules:
- Return STRICT valid JSON only. No markdown. No backticks. No explanation text.
- Keep the depth teacher-ready, classroom-usable, curriculum-aware, and exam-conscious where WAEC or NECO is selected.
- Preserve academic depth for Secondary and SS classes; include method-sensitive marking language for calculation subjects.
- For Mathematics, Further Mathematics, Physics, Chemistry, Biology, and quantitative subjects, use accurate formulas, units, symbols, step-by-step reasoning, substitutions, and final answers where relevant.
- For Primary and EYFS, keep the work age-appropriate, concrete, visual, active, and simple without reducing completeness.
- Nigerian Curriculum should be practical and teacher-friendly; Cambridge should be inquiry-based and skill-focused.
`.trim();

export function buildStage1Prompt(meta: GenerationMetadata) {
  return `
${qualityRules}

Audience:
- ${audience(meta)}

Generate Stage 1 of a complete LessonForge lesson pack: core lesson plan, detailed lesson notes, subject enrichment basics, references, and live applications.

Return JSON with this shape:
{
  "meta": { "subject": "", "topic": "", "grade": "", "curriculum": "", "examAlignment": "None", "schoolLevel": "", "numberOfSlides": 4, "durationMins": 40, "lessonType": "mixed", "academicDepth": "standard" },
  "lessonPlan": {
    "lessonTitle": "",
    "performanceObjectives": [],
    "successCriteria": [],
    "previousKnowledge": "",
    "instructionalMaterials": [],
    "lifeNatureActivities": [],
    "crossCurricularActivities": [],
    "keyVocabulary": [{ "word": "", "simpleMeaning": "" }],
    "commonMisconceptions": [],
    "introduction": "",
    "steps": [{ "stepNumber": 1, "stepTitle": "", "timeMinutes": 5, "teacherActivity": "", "learnerActivity": "", "guidedQuestions": [], "teachingMethod": "", "assessmentCheck": "", "concretisedLearningPoint": "" }],
    "differentiation": { "supportForStrugglingLearners": "", "supportForAverageLearners": "", "challengeForAdvancedLearners": "" },
    "realLifeApplications": [],
    "boardSummary": [],
    "evaluation": [{ "question": "", "questionType": "knowledge", "markingGuide": "" }],
    "exitTicket": [],
    "assignment": []
  },
  "lessonNotes": {
    "introduction": "",
    "keyConcepts": [{ "subheading": "", "content": "" }],
    "workedExamples": [{ "title": "", "problem": "", "steps": [], "finalAnswer": "", "explanation": "" }],
    "realLifeApplications": [],
    "summaryPoints": [],
    "exitTicket": [],
    "keyVocabulary": [{ "word": "", "meaning": "" }]
  },
  "subjectEnrichment": { "isCalculationBased": false, "coreFormulas": [], "symbolsAndUnits": [], "calculationRules": [], "extraWorkedExamples": [], "commonCalculationMistakes": [] },
  "references": [],
  "liveApplications": []
}

Stage 1 requirements:
- performanceObjectives: at least 3, measurable.
- successCriteria: at least 3.
- instructionalMaterials: 5 to 8.
- lifeNatureActivities and crossCurricularActivities: 2 to 4 each.
- keyVocabulary: 6 to 10.
- commonMisconceptions: 2 to 4.
- steps: exactly 4 to 6; guidedQuestions exactly 2 or 3 per step.
- evaluation: 3 to 5 formative/class questions with markingGuide.
- lessonNotes.keyConcepts: at least 3 detailed concepts.
- lessonNotes.workedExamples: at least 1, and more for calculation subjects.
- references: 3 to 5 realistic textbooks, curriculum guides, or standard class references.
- liveApplications: 3 to 5.
`.trim();
}

export function buildStage2Prompt(meta: GenerationMetadata, existing: JsonRecord) {
  return `
${qualityRules}

Audience:
- ${audience(meta)}

Existing Stage 1 lesson context:
${JSON.stringify({
  meta: existing.meta,
  lessonPlan: existing.lessonPlan,
  lessonNotes: existing.lessonNotes,
  subjectEnrichment: existing.subjectEnrichment,
}, null, 2)}

Generate Stage 2 of the same lesson pack: full assessment content, quiz, theory questions, and extra worked examples/enrichment at the same quality as a complete one-shot lesson pack.

Return JSON with this shape:
{
  "lessonPlan": {
    "evaluation": [{ "question": "", "questionType": "knowledge", "markingGuide": "" }],
    "exitTicket": [],
    "assignment": []
  },
  "subjectEnrichment": {
    "coreFormulas": [],
    "symbolsAndUnits": [],
    "calculationRules": [],
    "extraWorkedExamples": [{ "title": "", "problem": "", "steps": [], "finalAnswer": "", "explanation": "" }],
    "commonCalculationMistakes": []
  },
  "quiz": {
    "mcq": [{ "q": "", "options": ["", "", "", ""], "answerIndex": 0, "explanation": "" }],
    "theory": [{ "question": "", "markingGuide": "" }]
  }
}

Stage 2 requirements:
- MCQ: exactly 10 questions, 4 options each, answerIndex 0-3, 1-2 sentence explanation.
- Theory: exactly 2 questions, each with markingGuide.
- For WAEC/NECO, use exam-like phrasing and believable distractors.
- For quantitative subjects, include numerical/problem-solving MCQs and method-sensitive theory where relevant.
- evaluation: 5 strong classroom/exam-aware assessment questions with marking guides.
- extraWorkedExamples: include serious step-by-step examples for calculation subjects; otherwise include applied examples where useful.
`.trim();
}

export function buildStage3Prompt(meta: GenerationMetadata, existing: JsonRecord) {
  return `
${qualityRules}

Audience:
- ${audience(meta)}

Existing lesson context:
${JSON.stringify({
  meta: existing.meta,
  lessonPlan: existing.lessonPlan,
  lessonNotes: existing.lessonNotes,
  quiz: existing.quiz,
  subjectEnrichment: existing.subjectEnrichment,
}, null, 2)}

Generate Stage 3 of the same lesson pack: full lesson slide text only. Do not call, reference, or require any image API. Return plain strings for image_query, visual_suggestion, and video_query.

Return JSON with this shape:
{
  "slides": [{
    "slideNumber": 1,
    "slideType": "starter",
    "title": "",
    "bullets": [],
    "teacherPrompt": "",
    "studentTask": "",
    "imageQuery": "",
    "image_query": "",
    "visual_suggestion": "",
    "videoQuery": "",
    "video_query": "",
    "interactivePrompt": ""
  }]
}

Stage 3 requirements:
- Generate exactly ${meta.numberOfSlides} slides.
- Each slide must include 4 to 6 strong bullets.
- slideType should use starter, concept, worked_example, discussion, activity, quick_check, or recap.
- Include at least one worked_example slide for calculation-based lessons.
- image_query must be a specific 5-10 word search phrase tied to "${meta.topic}" and "${meta.subject}".
- image_query must include the topic, subject, and useful context such as Nigeria/Africa/culture/science/market/laboratory/map/diagram when relevant.
- Match image_query to slide purpose:
  - concept: real-world representation of the exact idea
  - vocabulary: simple visual example of a key term
  - worked_example: diagram-style educational visual, chart, graph, map, apparatus, or step example
  - discussion/activity/quick_check: concrete scenario or comparison from the slide content
- Do NOT use generic stock phrases such as "education books", "students learning", "school library", "classroom", "teacher teaching", "abstract background", or "study materials".
- visual_suggestion must describe the exact ideal visual for this slide in plain language, not a generic image category.
- video_query must be a useful YouTube/search query string, not a URL.
- interactivePrompt must be a practical classroom activity or check.
`.trim();
}
