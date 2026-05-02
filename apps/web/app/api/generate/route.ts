import OpenAI from "openai";
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import {
  consumeGenerationCredits,
  consumePersonalCreditsDirectly,
  getGenerationCreditAvailability,
} from "@/lib/credits/server";
import { ROLE_COOKIE_KEY } from "@/lib/auth/roles";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendEmail } from "@/lib/emails/send";
import {
  creditsFinishedEmail,
  creditsLowEmail,
} from "@/lib/emails/templates";
import { sendFirstGenerationEmailOnce } from "@/lib/emails/first-generation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;
export const maxDuration = 60;

const LESSON_PACK_CREDIT_COST = 4;

export type ExamAlignment = "None" | "WAEC" | "NECO";
export type SchoolLevel = "EYFS" | "Primary" | "Secondary";
export type LessonType = "theory" | "practical" | "mixed";
export type AcademicDepth = "foundational" | "standard" | "advanced";

export type SlideType =
  | "starter"
  | "concept"
  | "worked_example"
  | "discussion"
  | "activity"
  | "quick_check"
  | "recap";

export type QuestionType =
  | "knowledge"
  | "understanding"
  | "application"
  | "analysis"
  | "calculation";

export type GeneratePayload = {
  subject: string;
  topic: string;
  grade: string;
  curriculum?: string;
  examAlignment?: ExamAlignment;
  schoolLevel?: SchoolLevel;
  numberOfSlides?: number;
  durationMins?: number;
  user_id?: string;
  usePersonalCredits?: boolean;
};

export type VocabularyItem = {
  word: string;
  simpleMeaning: string;
};

export type LessonVocabularyItem = {
  word: string;
  meaning: string;
};

export type GuidedQuestion = string;

export type LessonStep = {
  stepNumber: number;
  stepTitle: string;
  timeMinutes: number;
  teacherActivity: string;
  learnerActivity: string;
  guidedQuestions: GuidedQuestion[];
  teachingMethod: string;
  assessmentCheck: string;
  concretisedLearningPoint: string;
};

export type Differentiation = {
  supportForStrugglingLearners: string;
  supportForAverageLearners: string;
  challengeForAdvancedLearners: string;
};

export type EvaluationItem = {
  question: string;
  questionType: QuestionType;
  markingGuide: string;
};

export type TheoryQuestion = {
  question: string;
  markingGuide: string;
};

export type MCQItem = {
  q: string;
  options: [string, string, string, string];
  answerIndex: 0 | 1 | 2 | 3;
  explanation: string;
};

export type SlideItem = {
  slideNumber: number;
  slideType: SlideType;
  title: string;
  bullets: string[];
  teacherPrompt: string;
  studentTask: string;
  imageQuery: string;
  videoQuery: string;
  interactivePrompt: string;
  image?: string;
};

export type LessonPlan = {
  lessonTitle: string;
  performanceObjectives: string[];
  successCriteria: string[];
  previousKnowledge: string;
  instructionalMaterials: string[];
  lifeNatureActivities: string[];
  crossCurricularActivities: string[];
  keyVocabulary: VocabularyItem[];
  commonMisconceptions: string[];
  introduction: string;
  steps: LessonStep[];
  differentiation: Differentiation;
  realLifeApplications: string[];
  boardSummary: string[];
  evaluation: EvaluationItem[];
  exitTicket: string[];
  assignment: string[];
};

export type WorkedExample = {
  title: string;
  problem: string;
  steps: string[];
  finalAnswer: string;
  explanation: string;
};

export type KeyConcept = {
  subheading: string;
  content: string;
};

export type LessonNotes = {
  introduction: string;
  keyConcepts: KeyConcept[];
  workedExamples: WorkedExample[];
  realLifeApplications: string[];
  summaryPoints: string[];
  exitTicket: string[];
  keyVocabulary: LessonVocabularyItem[];
};

export type FormulaItem = {
  name: string;
  formula: string;
  meaning: string;
  units: string;
};

export type SymbolUnitItem = {
  symbol: string;
  meaning: string;
  unit: string;
};

export type SubjectEnrichment = {
  isCalculationBased: boolean;
  coreFormulas: FormulaItem[];
  symbolsAndUnits: SymbolUnitItem[];
  calculationRules: string[];
  extraWorkedExamples: WorkedExample[];
  commonCalculationMistakes: string[];
};

export type LessonMeta = {
  subject: string;
  topic: string;
  grade: string;
  curriculum: string;
  examAlignment: ExamAlignment;
  schoolLevel: SchoolLevel;
  numberOfSlides: number;
  durationMins: number;
  lessonType: LessonType;
  academicDepth: AcademicDepth;
};

export type GeneratedLessonData = {
  meta: LessonMeta;
  lessonPlan: LessonPlan;
  lessonNotes: LessonNotes;
  subjectEnrichment: SubjectEnrichment;
  references: string[];
  slides: SlideItem[];
  quiz: {
    mcq: MCQItem[];
    theory: TheoryQuestion[];
  };
  liveApplications: string[];
};

function clampNumber(value: number | undefined, min: number, max: number, fallback: number) {
  if (typeof value !== "number" || Number.isNaN(value)) return fallback;
  return Math.max(min, Math.min(max, value));
}

function normalizeNumber(
  value: unknown,
  fallback: number,
  min: number,
  max: number
): number {
  if (typeof value === "number" && !Number.isNaN(value)) {
    return Math.max(min, Math.min(max, value));
  }

  if (typeof value === "string") {
    const parsed = Number(value.trim());
    if (!Number.isNaN(parsed)) {
      return Math.max(min, Math.min(max, parsed));
    }
  }

  return fallback;
}

function normalizeEnum<T extends string>(
  value: unknown,
  allowed: ReadonlyArray<T>,
  fallback: T
): T {
  if (typeof value !== "string") return fallback;
  const normalized = value.trim() as T;
  return allowed.includes(normalized) ? normalized : fallback;
}

function normalizeExamAlignment(
  value: unknown,
  fallback: ExamAlignment
): ExamAlignment {
  return normalizeEnum(value, ["None", "WAEC", "NECO"] as const, fallback);
}

function normalizeSchoolLevel(
  value: unknown,
  fallback: SchoolLevel
): SchoolLevel {
  return normalizeEnum(value, ["EYFS", "Primary", "Secondary"] as const, fallback);
}

function normalizeLessonType(
  value: unknown,
  fallback: LessonType
): LessonType {
  return normalizeEnum(value, ["theory", "practical", "mixed"] as const, fallback);
}

function normalizeAcademicDepth(
  value: unknown,
  fallback: AcademicDepth
): AcademicDepth {
  return normalizeEnum(
    value,
    ["foundational", "standard", "advanced"] as const,
    fallback
  );
}

function normalizeQuestionType(
  value: unknown,
  fallback: QuestionType
): QuestionType {
  return normalizeEnum(
    value,
    ["knowledge", "understanding", "application", "analysis", "calculation"] as const,
    fallback
  );
}

function normalizeSlideType(value: unknown, fallback: SlideType): SlideType {
  return normalizeEnum(
    value,
    [
      "starter",
      "concept",
      "worked_example",
      "discussion",
      "activity",
      "quick_check",
      "recap",
    ] as const,
    fallback
  );
}

function inferCalculationBased(subject: string, topic: string): boolean {
  const normalized = `${subject} ${topic}`.toLowerCase();
  const calculationSubjects = [
    "math",
    "mathematics",
    "physics",
    "chemistry",
    "economics",
    "accounting",
    "financial",
    "statistics",
    "geometry",
    "trigonometry",
    "algebra",
  ];
  return calculationSubjects.some((term) => normalized.includes(term));
}

function inferLessonType(subject: string, topic: string): LessonType {
  const normalized = `${subject} ${topic}`.toLowerCase();
  if (/(experiment|practical|activity|investigation|field)/.test(normalized)) {
    return "practical";
  }
  if (/(theory|concept|explain|understand|classification)/.test(normalized)) {
    return "theory";
  }
  return "mixed";
}

function inferAcademicDepth(schoolLevel: SchoolLevel, grade: string): AcademicDepth {
  const normalizedGrade = grade?.toString().toLowerCase();
  if (schoolLevel === "EYFS") return "foundational";
  if (/ss[1-3]|jss[1-3]|year\s?[1-9]/i.test(normalizedGrade || "")) {
    return "standard";
  }
  if (/ss[4-6]|year\s?(12|13)|upper\s+secondary/i.test(normalizedGrade || "")) {
    return "advanced";
  }
  return "standard";
}

function normalizeLessonVocabularyArray(value: unknown) {
  if (!Array.isArray(value)) return [];

  return value
    .map((item) => {
      if (typeof item !== "object" || item === null) return null;
      const record = item as Record<string, unknown>;

      return {
        word: normalizeString(record.word),
        meaning:
          normalizeString(record.meaning) ||
          normalizeString(record.simpleMeaning),
      };
    })
    .filter((item): item is { word: string; meaning: string } => {
      return !!item && (!!item.word || !!item.meaning);
    });
}

function normalizeKeyConceptArray(value: unknown) {
  if (!Array.isArray(value)) return [];

  return value
    .map((item) => {
      if (typeof item !== "object" || item === null) return null;
      const record = item as Record<string, unknown>;

      return {
        subheading: normalizeString(record.subheading),
        content: normalizeString(record.content),
      };
    })
    .filter((item): item is { subheading: string; content: string } => {
      return !!item && (!!item.subheading || !!item.content);
    });
}

function normalizeWorkedExampleArray(value: unknown) {
  if (!Array.isArray(value)) return [];

  return value
    .map((item) => {
      if (typeof item !== "object" || item === null) return null;
      const record = item as Record<string, unknown>;

      return {
        title: normalizeString(record.title),
        problem: normalizeString(record.problem),
        steps: normalizeStringArray(record.steps),
        finalAnswer: normalizeString(record.finalAnswer),
        explanation: normalizeString(record.explanation),
      };
    })
    .filter(
      (
        item
      ): item is {
        title: string;
        problem: string;
        steps: string[];
        finalAnswer: string;
        explanation: string;
      } =>
        !!item &&
        (!!item.title ||
          !!item.problem ||
          item.steps.length > 0 ||
          !!item.finalAnswer ||
          !!item.explanation)
    );
}

function normalizeLessonNotes(value: unknown) {
  if (typeof value === "string") {
    return {
      introduction: value.trim(),
      keyConcepts: [],
      workedExamples: [],
      realLifeApplications: [],
      summaryPoints: [],
      exitTicket: [],
      keyVocabulary: [],
    };
  }

  if (typeof value !== "object" || value === null) {
    return {
      introduction: "",
      keyConcepts: [],
      workedExamples: [],
      realLifeApplications: [],
      summaryPoints: [],
      exitTicket: [],
      keyVocabulary: [],
    };
  }

  const record = value as Record<string, unknown>;

  return {
    introduction: normalizeString(record.introduction),
    keyConcepts: normalizeKeyConceptArray(record.keyConcepts),
    workedExamples: normalizeWorkedExampleArray(record.workedExamples),
    realLifeApplications: normalizeStringArray(record.realLifeApplications),
    summaryPoints: normalizeStringArray(record.summaryPoints),
    exitTicket: normalizeStringArray(record.exitTicket),
    keyVocabulary: normalizeLessonVocabularyArray(record.keyVocabulary),
  };
}

function normalizeFormulaArray(value: unknown) {
  if (!Array.isArray(value)) return [];

  return value
    .map((item) => {
      if (typeof item !== "object" || item === null) return null;
      const record = item as Record<string, unknown>;

      return {
        name: normalizeString(record.name),
        formula: normalizeString(record.formula),
        meaning: normalizeString(record.meaning),
        units: normalizeString(record.units),
      };
    })
    .filter(
      (
        item
      ): item is {
        name: string;
        formula: string;
        meaning: string;
        units: string;
      } => !!item && (!!item.name || !!item.formula || !!item.meaning || !!item.units)
    );
}

function normalizeSymbolUnitArray(value: unknown) {
  if (!Array.isArray(value)) return [];

  return value
    .map((item) => {
      if (typeof item !== "object" || item === null) return null;
      const record = item as Record<string, unknown>;

      return {
        symbol: normalizeString(record.symbol),
        meaning: normalizeString(record.meaning),
        unit: normalizeString(record.unit),
      };
    })
    .filter(
      (
        item
      ): item is {
        symbol: string;
        meaning: string;
        unit: string;
      } => !!item && (!!item.symbol || !!item.meaning || !!item.unit)
    );
}

function normalizeSubjectEnrichment(
  value: unknown,
  body: GeneratePayload
) {
  const inferredCalculationBased = inferCalculationBased(body.subject, body.topic);

  if (typeof value !== "object" || value === null) {
    return {
      isCalculationBased: inferredCalculationBased,
      coreFormulas: [],
      symbolsAndUnits: [],
      calculationRules: [],
      extraWorkedExamples: [],
      commonCalculationMistakes: [],
    };
  }

  const record = value as Record<string, unknown>;

  return {
    isCalculationBased:
      typeof record.isCalculationBased === "boolean"
        ? record.isCalculationBased
        : inferredCalculationBased,
    coreFormulas: normalizeFormulaArray(record.coreFormulas),
    symbolsAndUnits: normalizeSymbolUnitArray(record.symbolsAndUnits),
    calculationRules: normalizeStringArray(record.calculationRules),
    extraWorkedExamples: normalizeWorkedExampleArray(record.extraWorkedExamples),
    commonCalculationMistakes: normalizeStringArray(
      record.commonCalculationMistakes
    ),
  };
}

function normalizeString(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value.trim() : fallback;
}

function getFirstName(value: unknown, fallback = "there") {
  const name = String(value ?? "").trim();
  if (!name) return fallback;
  return name.split(/\s+/)[0] || fallback;
}

function normalizeStringArray(value: unknown, fallback: string[] = []): string[] {
  if (!Array.isArray(value)) return fallback;
  return value
    .map((item) => (typeof item === "string" ? item.trim() : ""))
    .filter(Boolean);
}

function normalizeVocabularyArray(value: unknown): VocabularyItem[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => {
      if (typeof item === "object" && item !== null) {
        const word = normalizeString((item as Record<string, unknown>).word);
        const simpleMeaning = normalizeString(
          (item as Record<string, unknown>).simpleMeaning
        );
        if (word && simpleMeaning) return { word, simpleMeaning };
      }
      if (typeof item === "string" && item.trim()) {
        return { word: item.trim(), simpleMeaning: "" };
      }
      return null;
    })
    .filter(Boolean) as VocabularyItem[];
}

function normalizeEvaluationArray(value: unknown) {
  if (!Array.isArray(value)) return [];

  return value
    .map((item) => {
      if (typeof item === "string") {
        return {
          question: item.trim(),
          questionType: "knowledge" as QuestionType,
          markingGuide: "",
        };
      }

      if (typeof item !== "object" || item === null) return null;
      const record = item as Record<string, unknown>;

      return {
        question:
          normalizeString(record.question) || normalizeString(record.q),
        questionType: normalizeQuestionType(record.questionType, "knowledge"),
        markingGuide: normalizeString(record.markingGuide),
      };
    })
    .filter(
      (
        item
      ): item is {
        question: string;
        questionType: QuestionType;
        markingGuide: string;
      } => !!item && !!item.question
    );
}

function normalizeTheoryArray(value: unknown) {
  if (!Array.isArray(value)) return [];

  return value
    .map((item) => {
      if (typeof item === "string") {
        return {
          question: item.trim(),
          markingGuide: "",
        };
      }

      if (typeof item !== "object" || item === null) return null;
      const record = item as Record<string, unknown>;

      return {
        question:
          normalizeString(record.question) || normalizeString(record.q),
        markingGuide: normalizeString(record.markingGuide),
      };
    })
    .filter(
      (item): item is { question: string; markingGuide: string } =>
        !!item && !!item.question
    );
}

function normalizeMCQArray(value: unknown) {
  if (!Array.isArray(value)) return [];

  return value
    .map((item) => {
      if (typeof item !== "object" || item === null) return null;
      const record = item as Record<string, unknown>;

      const options = normalizeStringArray(record.options).slice(0, 4);
      while (options.length < 4) options.push("");

      const rawAnswerIndex =
        typeof record.answerIndex === "number"
          ? record.answerIndex
          : typeof record.answerIndex === "string"
          ? Number(record.answerIndex)
          : -1;

      const answerIndex =
        rawAnswerIndex >= 0 && rawAnswerIndex <= 3 ? rawAnswerIndex : 0;

      return {
        q: normalizeString(record.q, normalizeString(record.question)),
        options: options as [string, string, string, string],
        answerIndex: answerIndex as 0 | 1 | 2 | 3,
        explanation: normalizeString(record.explanation),
      };
    })
    .filter(
      (
        item
      ): item is {
        q: string;
        options: [string, string, string, string];
        answerIndex: 0 | 1 | 2 | 3;
        explanation: string;
      } => !!item && !!item.q
    );
}
function normalizeSlideArray(value: unknown): SlideItem[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item, index) => {
      if (typeof item !== "object" || item === null) return null;

      const record = item as Record<string, unknown>;
      const title = normalizeString(record.title);
      const bullets = normalizeStringArray(record.bullets).slice(0, 6);
      while (bullets.length < 4) bullets.push("");
      const imageQuery = normalizeString(record.imageQuery);
      const videoQuery = normalizeString(record.videoQuery);
      const interactivePrompt = normalizeString(record.interactivePrompt);
      const image = normalizeString(record.image);

      return {
        slideNumber: normalizeNumber(record.slideNumber, index + 1, 1, 999),
        slideType: normalizeSlideType(
          record.slideType,
          index === 0 ? "starter" : "concept"
        ),
        title,
        bullets,
        teacherPrompt: normalizeString(record.teacherPrompt),
        studentTask: normalizeString(record.studentTask),
        imageQuery,
        videoQuery,
        interactivePrompt,
        image: image || undefined,
      };
    })
    .filter(Boolean) as SlideItem[];
}

function normalizeStepArray(value: unknown): LessonStep[] {
  if (!Array.isArray(value)) return [];

  return value
    .map((item, index) => {
      if (typeof item !== "object" || item === null) return null;
      const record = item as Record<string, unknown>;

      return {
        stepNumber: normalizeNumber(record.stepNumber, index + 1, 1, 999),
        stepTitle: normalizeString(record.stepTitle),
        timeMinutes: normalizeNumber(record.timeMinutes, 5, 1, 60),
        teacherActivity: normalizeString(record.teacherActivity),
        learnerActivity: normalizeString(record.learnerActivity),
        guidedQuestions: normalizeStringArray(record.guidedQuestions),
        teachingMethod: normalizeString(record.teachingMethod),
        assessmentCheck: normalizeString(record.assessmentCheck),
        concretisedLearningPoint: normalizeString(
          record.concretisedLearningPoint
        ),
      };
    })
    .filter((item): item is LessonStep => !!item);
}

function buildUserInstructions(input: GeneratePayload) {
  const curriculum = input.curriculum ?? "Nigerian Curriculum";
  const examAlignment = input.examAlignment ?? "None";
  const durationMins = clampNumber(input.durationMins, 10, 180, 40);
  const schoolLevel = input.schoolLevel ?? "Secondary";
  const numberOfSlides = clampNumber(input.numberOfSlides, 1, 20, 8);

  return `
Return STRICT valid JSON only. No markdown. No backticks. No explanation text.

Audience:
- School Level: ${schoolLevel}
- Class / Grade: ${input.grade}
- Subject: ${input.subject}
- Topic: ${input.topic}
- Curriculum: ${curriculum}
- Exam Alignment: ${examAlignment}
- Duration: ${durationMins} minutes
- Number of Slides: ${numberOfSlides}

You MUST output JSON with exactly this top-level shape:
{
  "meta": {
    "subject": "",
    "topic": "",
    "grade": "",
    "curriculum": "",
    "examAlignment": "None",
    "schoolLevel": "",
    "numberOfSlides": 8,
    "durationMins": 40,
    "lessonType": "theory",
    "academicDepth": "standard"
  },
  "lessonPlan": {
    "lessonTitle": "",
    "performanceObjectives": ["..."],
    "successCriteria": ["..."],
    "previousKnowledge": "",
    "instructionalMaterials": ["..."],
    "lifeNatureActivities": ["..."],
    "crossCurricularActivities": ["..."],
    "keyVocabulary": [
      { "word": "", "simpleMeaning": "" }
    ],
    "commonMisconceptions": ["..."],
    "introduction": "",
    "steps": [
      {
        "stepNumber": 1,
        "stepTitle": "",
        "timeMinutes": 5,
        "teacherActivity": "",
        "learnerActivity": "",
        "guidedQuestions": ["...", "..."],
        "teachingMethod": "",
        "assessmentCheck": "",
        "concretisedLearningPoint": ""
      }
    ],
    "differentiation": {
      "supportForStrugglingLearners": "",
      "supportForAverageLearners": "",
      "challengeForAdvancedLearners": ""
    },
    "realLifeApplications": ["..."],
    "boardSummary": ["..."],
    "evaluation": [
      {
        "question": "",
        "questionType": "knowledge",
        "markingGuide": ""
      }
    ],
    "exitTicket": ["..."],
    "assignment": ["..."]
  },
  "lessonNotes": {
    "introduction": "",
    "keyConcepts": [
      {
        "subheading": "",
        "content": ""
      }
    ],
    "workedExamples": [
      {
        "title": "",
        "problem": "",
        "steps": ["..."],
        "finalAnswer": "",
        "explanation": ""
      }
    ],
    "realLifeApplications": ["..."],
    "summaryPoints": ["..."],
    "exitTicket": ["...", "...", "..."],
    "keyVocabulary": [
      { "word": "", "meaning": "" }
    ]
  },
  "subjectEnrichment": {
    "isCalculationBased": false,
    "coreFormulas": [
      {
        "name": "",
        "formula": "",
        "meaning": "",
        "units": ""
      }
    ],
    "symbolsAndUnits": [
      {
        "symbol": "",
        "meaning": "",
        "unit": ""
      }
    ],
    "calculationRules": ["..."],
    "extraWorkedExamples": [
      {
        "title": "",
        "problem": "",
        "steps": ["..."],
        "finalAnswer": "",
        "explanation": ""
      }
    ],
    "commonCalculationMistakes": ["..."]
  },
  "references": ["...", "...", "..."],
  "slides": [
    {
      "slideNumber": 1,
      "slideType": "starter",
      "title": "",
      "bullets": ["", "", "", ""],
      "teacherPrompt": "",
      "studentTask": "",
      "imageQuery": "",
      "videoQuery": "",
      "interactivePrompt": ""
    }
  ],
  "quiz": {
    "mcq": [
      {
        "q": "",
        "options": ["", "", "", ""],
        "answerIndex": 0,
        "explanation": ""
      }
    ],
    "theory": [
      {
        "question": "",
        "markingGuide": ""
      }
    ]
  },
  "liveApplications": ["..."]
}

HARD REQUIREMENTS — STRICT COMPLIANCE REQUIRED

You are generating a COMPLETE, CLASSROOM-READY LESSON PACKAGE for real teachers.

The output must be:
- practical
- structured
- teacher-friendly
- student-understandable
- globally standard
- academically sound
- usable WITHOUT needing a textbook or external AI

========================
META (REQUIRED)
========================
Fill ALL meta fields correctly:
- subject
- topic
- grade
- curriculum
- examAlignment (None / WAEC / NECO)
- schoolLevel (EYFS / Primary / Secondary)
- numberOfSlides
- durationMins
- lessonType
- academicDepth

lessonType:
- "theory" for concept-heavy lessons
- "practical" for experiment / activity-based lessons
- "mixed" for both

academicDepth:
- "foundational" for EYFS / lower Primary
- "standard" for upper Primary / lower Secondary
- "advanced" for upper Secondary and exam classes where appropriate

========================
LESSON PLAN (CORE ENGINE)
========================
lessonPlan MUST include:
- lessonTitle
- performanceObjectives
- successCriteria
- previousKnowledge
- instructionalMaterials
- lifeNatureActivities
- crossCurricularActivities
- keyVocabulary
- commonMisconceptions
- introduction
- steps
- differentiation
- realLifeApplications
- boardSummary
- evaluation
- exitTicket
- assignment

------------------------
PERFORMANCE OBJECTIVES
------------------------
- EXACTLY 3 TO 5 objectives
- Must start with strong action verbs:
  identify, define, explain, describe, demonstrate, classify, compare, construct, solve, create, observe, present, calculate, derive, analyse
- Must be measurable and learner-centered
- Must reflect what learners will actually DO

------------------------
SUCCESS CRITERIA
------------------------
- EXACTLY 3 TO 5 items
- Use "Learners can..." or "I can..."
- Must align directly with objectives
- Must be simple and assessable

------------------------
PREVIOUS KNOWLEDGE
------------------------
- 1 short paragraph
- Must connect clearly to what learners already know

------------------------
INSTRUCTIONAL MATERIALS
------------------------
- 5 to 10 items
- Must include:
  classroom tools
  visual aids
  concrete/local materials
- For science/calculation subjects, include where relevant:
  graph sheet, calculator, ruler, apparatus, chart, periodic table, formula sheet, specimen

------------------------
LIFE / NATURE ACTIVITIES
------------------------
- 2 to 4 items
- Must connect learning to:
  environment, home, farm, road, weather, health, plants, animals, community

------------------------
CROSS-CURRICULAR ACTIVITIES
------------------------
- 2 to 4 items
- Must connect to other subjects:
  Maths, English, ICT, Civic, Agriculture, Geography, Business, etc.

------------------------
KEY VOCABULARY
------------------------
- 6 to 10 items
- Each must include:
  word
  simpleMeaning

------------------------
COMMON MISCONCEPTIONS
------------------------
- EXACTLY 2 to 4 items
- Must reflect REAL student mistakes
- Must help teachers anticipate and address misunderstandings

------------------------
INTRODUCTION
------------------------
- 1 short engaging paragraph
- Must use familiar real-life or local situations
- Must hook learners immediately
- Must include a creative local analogy or story-based hook, preferably a Nigerian everyday-life example when the curriculum or context is Nigerian
- Example style: connect the topic to a market scene, football game, bus stop, family cooking, rainfall, farm work, mobile money, electricity use, classroom routine, or another familiar community situation

========================
STEP-BY-STEP LESSON DELIVERY (CRITICAL)
========================
- EXACTLY 4 steps/phases, no more and no fewer, in this exact order:
  1. Introduction
  2. Development
  3. Application
  4. Conclusion
- Each phase MUST have a clear time allocation.

Each step MUST include:
- stepNumber
- stepTitle
- timeMinutes
- teacherActivity
- learnerActivity
- guidedQuestions
- teachingMethod
- assessmentCheck
- concretisedLearningPoint

RULES:
- Must feel like REAL teaching flow
- timeMinutes must be realistic and sum approximately to the lesson duration
- teacherActivity MUST begin with a minute-by-minute range such as "Minutes 0-5:" or "Minutes 10-18:" and give a minute-by-minute teacher activity breakdown for that phase
- teacherActivity MUST include exact teacher dialogue examples using quoted speech, showing what the teacher should SAY word-for-word, for example: Teacher says, "Look at this example from our local market..."
- teacherActivity MUST include explanation, questioning, demonstration, guided discovery, real objects, drawing, role play, worked examples, board illustration, or experiment where relevant
- The Introduction step MUST contain a creative local Nigerian/African analogy or story-based hook tied to the topic
- learnerActivity MUST be ACTIVE and must correspond directly to the same minute range and phase as teacherActivity
- learnerActivity MUST describe the corresponding student activity for each minute range/phase, including what students say, write, discuss, calculate, observe, sort, present, or practise
- guidedQuestions must contain EXACTLY 2 or 3 short student engagement questions the teacher asks the class
- teachingMethod must be specific
- assessmentCheck must include a quick observable check
- concretisedLearningPoint must state what learners now understand or can do
- Steps must build logically
- Step titles must clearly name the phase, for example: "Introduction: Local hook and prior knowledge", "Development: Teacher demonstration", "Application: Guided practice", "Conclusion: Recap and exit check"

========================
LESSON NOTES (STRUCTURED)
========================
lessonNotes MUST be an object, not a plain string.

lessonNotes.introduction:
- 1 to 2 paragraphs
- clear and engaging

lessonNotes.keyConcepts:
- 3 to 6 objects
- each object must contain:
  - subheading
  - content
- content must be rich, clear, student-friendly, and academically correct

lessonNotes.workedExamples:
- MINIMUM 2 examples
- For non-calculation subjects, use classification, interpretation, comparison, or applied reasoning examples
- For calculation subjects, must be step-by-step numerical or symbolic solutions

Each worked example MUST include:
- title
- problem
- steps
- finalAnswer
- explanation

lessonNotes.realLifeApplications:
- MINIMUM 3 items
- local and practical where possible

lessonNotes.summaryPoints:
- 5 to 8 bullet points

lessonNotes.exitTicket:
- EXACTLY 3 short questions

lessonNotes.keyVocabulary:
- MINIMUM 8 terms with meanings

========================
SUBJECT ENRICHMENT (CRITICAL FOR HYBRID MODEL)
========================
subjectEnrichment MUST always exist.

Set isCalculationBased = true ONLY if the subject/topic requires calculations, formulas, symbolic manipulation, balancing equations, graphs, measurements, or quantitative reasoning.

Calculation-based subjects often include:
- Mathematics
- Further Mathematics
- Physics
- Chemistry
- Economics (selected topics)
- Financial Accounting (selected topics)
- Geography (selected quantitative topics)

If isCalculationBased = false:
- coreFormulas may be empty
- symbolsAndUnits may be empty
- calculationRules may be empty
- extraWorkedExamples may be empty
- commonCalculationMistakes may be empty

If isCalculationBased = true:
You MUST populate all fields meaningfully.

subjectEnrichment.coreFormulas:
- 3 to 8 formula objects where relevant
- each object must include:
  - name
  - formula
  - meaning
  - units

subjectEnrichment.symbolsAndUnits:
- include important variables and units
- examples:
  v = velocity = m/s
  F = force = N
  n = amount of substance = mol

subjectEnrichment.calculationRules:
- 3 to 6 short rules
- examples:
  - convert to SI units before substitution
  - include units in final answer
  - balance equation before mole ratio
  - round only at final step

subjectEnrichment.extraWorkedExamples:
- 2 to 4 extra examples for Secondary calculation-based lessons
- MUST be exam-standard where relevant
- MUST show full step-by-step method

subjectEnrichment.commonCalculationMistakes:
- 2 to 5 real mistakes students make

========================
DIFFERENTIATION
========================
Must include:
- supportForStrugglingLearners
- supportForAverageLearners
- challengeForAdvancedLearners

Must be practical and usable

========================
BOARD SUMMARY
========================
- 5 to 10 short points
- Must be what the teacher can actually write on the board
- For calculation-based lessons, include formulas, steps, laws, or rules where relevant

========================
EVALUATION
========================
- EXACTLY 5 questions
- Must intentionally mix:
  - at least 1 knowledge question
  - at least 1 understanding question
  - at least 1 application question
- For secondary calculation-based lessons, include at least 1 calculation or worked-response item
- Each must include:
  - question
  - questionType
  - markingGuide

Allowed questionType values:
- knowledge
- understanding
- application
- analysis
- calculation

========================
EXIT TICKET
========================
- EXACTLY 3 short questions
- quick understanding check

========================
ASSIGNMENT
========================
- EXACTLY 3 items
- Must include:
  - practice
  - real-life connection
  - extension/challenge

========================
SLIDES
========================
- EXACTLY ${numberOfSlides} slides

Each slide MUST include:
- slideNumber
- slideType
- title
- bullets
- teacherPrompt
- studentTask
- imageQuery
- videoQuery
- interactivePrompt

Allowed slideType values:
- starter
- concept
- worked_example
- discussion
- activity
- quick_check
- recap

Rules:
- bullets must be 4 to 6 only
- bullets must be short and presentation-ready
- not copied directly from lesson notes
- teacherPrompt = what the teacher says or highlights
- studentTask = what students do on that slide
- interactivePrompt must create participation
- For calculation-based lessons, at least 1 slide must be "worked_example"
- Final slide should usually be "recap" or "quick_check"

========================
QUIZ
========================
MCQ:
- EXACTLY 10 questions
- Each must include:
  - q
  - options (4)
  - answerIndex
  - explanation

Rules:
- For Mathematics, Further Mathematics, Physics, Chemistry, Biology, and other science-heavy Secondary subjects:
  - use a mixed difficulty set of about 30% easy, 40% medium, and 30% hard questions
  - easy should be straightforward concept or simple calculation questions
  - medium should require one-step reasoning, application, comparison, or interpretation
  - hard should involve multi-step reasoning, application of concepts, realistic exam-style problem solving, or calculation where relevant
  - hard must not be confusing for no reason; distractors should be believable and based on common misconceptions or method errors
- If examAlignment = WAEC or NECO:
  - use exam-like phrasing and structured wording
  - include some higher-order questions and clear exam-aware language
  - make distractors believable and aligned with common student traps
  - for calculation subjects, include numerical/problem-solving MCQs where appropriate
- For Primary and EYFS:
  - keep questions age-appropriate, simple, and not artificially hard
  - focus on conceptual understanding and clear reasoning at the right level
- Use plausible distractors
- explanation must be 1 to 2 sentences
- For calculation-based subjects, include numerical or formula-based MCQs where appropriate

Theory:
- EXACTLY 2 questions
- Each must include markingGuide
- For science and calculation subjects, theory questions must test explanation, working, reasoning, or application rather than only recall
- If examAlignment = WAEC or NECO, phrasing should feel exam-aware

========================
LIVE APPLICATIONS
========================
- 3 to 5 items
- Must show real-world use:
  home, school, industry, transport, agriculture, health, environment, technology, business, etc.

========================
REFERENCES
========================
- 3 to 5 items
- Must be realistic textbooks, curriculum guides, or standard class references
- No fake authors, fake publishers, or fake editions
- If exact edition is uncertain, keep the reference general and realistic

========================
LEVEL ADAPTATION
========================
EYFS:
- playful, visual, simple, concrete
- use songs, objects, pictures, movement, imitation, tracing, matching, colouring, naming
- avoid abstract explanation
- do not force formulas unless absolutely necessary

PRIMARY:
- simple, vivid, relatable
- use familiar examples from home, school, playground, market, family, weather, animals, food, transport
- encourage observation, drawing, discussion, and guided practice
- if calculations appear, keep them simple and concrete

SECONDARY:
- structured, exam-aware, deeper reasoning
- clear, practical, and classroom-usable
- include stronger reasoning, comparison, examples, derivations, formulas, principles, and applications where relevant
- for SS1–SS3 calculation-based lessons, include serious academic depth and exam-standard worked examples

========================
SUBJECT-SPECIFIC DEPTH RULE
========================
For Mathematics, Further Mathematics, Physics, Chemistry, Biology, and other quantitative subjects:
- use accurate formulas
- define symbols
- include units where appropriate
- provide step-by-step worked examples
- use exam-style phrasing for Secondary when relevant
- avoid vague summaries
- show substitution clearly
- show final answers clearly
- include method-sensitive marking language where appropriate
- ensure theory questions test explanation, reasoning, and working, not just recall

For Chemistry specifically:
- include balanced equations where relevant
- distinguish formula, equation, observation, and inference when needed
- use correct chemical notation

For Physics specifically:
- include units and SI conversion where needed
- state laws/principles clearly
- show substitutions properly

For Mathematics and Further Mathematics:
- show method step by step
- use proper notation
- include simplification and final answer clearly

========================
CURRICULUM & EXAM ADAPTATION
========================
- Nigerian Curriculum → practical, teacher-friendly, classroom-usable
- Cambridge → inquiry-based, skill-focused, conceptually clear

If examAlignment = WAEC or NECO:
- MUST be exam-conscious
- use structured phrasing
- include exam-style evaluation and theory where appropriate
- for calculation subjects, include method-sensitive worked examples and marking logic

========================
IMAGE QUALITY RULE
========================
imageQuery MUST produce:
- textbook-style diagrams
- labeled educational visuals
- realistic academic illustrations
- mature classroom-safe visuals

Avoid:
- childish cartoons
- decorative AI-art style
- random stock-photo look
- vague or generic visuals

========================
FINAL RULE
========================
This lesson must be so complete that a teacher can teach directly from it WITHOUT needing a textbook or external AI.

Return VALID JSON only.
`.trim();
}

function normalizeGeneratedData(
  rawData: unknown,
  body: GeneratePayload
): GeneratedLessonData {
  const curriculum = body.curriculum ?? "Nigerian Curriculum";
  const examAlignment = normalizeExamAlignment(body.examAlignment, "None");
  const schoolLevel = normalizeSchoolLevel(body.schoolLevel, "Secondary");
  const numberOfSlides = clampNumber(body.numberOfSlides, 1, 20, 8);
  const durationMins = clampNumber(body.durationMins, 10, 180, 40);

  const record =
    typeof rawData === "object" && rawData !== null
      ? (rawData as Record<string, unknown>)
      : {};

  const meta =
    typeof record.meta === "object" && record.meta !== null
      ? (record.meta as Record<string, unknown>)
      : {};

  const lessonPlanRecord =
    typeof record.lessonPlan === "object" && record.lessonPlan !== null
      ? (record.lessonPlan as Record<string, unknown>)
      : {};

  const differentiationRecord =
    typeof lessonPlanRecord.differentiation === "object" &&
    lessonPlanRecord.differentiation !== null
      ? (lessonPlanRecord.differentiation as Record<string, unknown>)
      : {};

  const normalizedSchoolLevel = normalizeSchoolLevel(
    meta.schoolLevel,
    schoolLevel
  );

  const normalizedLessonPlan: LessonPlan = {
    lessonTitle:
      normalizeString(lessonPlanRecord.lessonTitle) ||
      normalizeString(lessonPlanRecord.title) ||
      `${body.subject} - ${body.topic}`,

    performanceObjectives: normalizeStringArray(
      lessonPlanRecord.performanceObjectives,
      normalizeStringArray(record.objectives)
    ),

    successCriteria: normalizeStringArray(lessonPlanRecord.successCriteria),

    previousKnowledge: normalizeString(lessonPlanRecord.previousKnowledge),

    instructionalMaterials: normalizeStringArray(
      lessonPlanRecord.instructionalMaterials
    ),

    lifeNatureActivities: normalizeStringArray(
      lessonPlanRecord.lifeNatureActivities
    ),

    crossCurricularActivities: normalizeStringArray(
      lessonPlanRecord.crossCurricularActivities
    ),

    keyVocabulary: normalizeVocabularyArray(lessonPlanRecord.keyVocabulary),

    commonMisconceptions: normalizeStringArray(
      lessonPlanRecord.commonMisconceptions
    ),

    introduction: normalizeString(lessonPlanRecord.introduction),

    steps: normalizeStepArray(lessonPlanRecord.steps),

    differentiation: {
      supportForStrugglingLearners: normalizeString(
        differentiationRecord.supportForStrugglingLearners
      ),
      supportForAverageLearners: normalizeString(
        differentiationRecord.supportForAverageLearners
      ),
      challengeForAdvancedLearners: normalizeString(
        differentiationRecord.challengeForAdvancedLearners
      ),
    },

    realLifeApplications: normalizeStringArray(
      lessonPlanRecord.realLifeApplications,
      normalizeStringArray(lessonPlanRecord.realLifeConnection)
    ),

    boardSummary: normalizeStringArray(lessonPlanRecord.boardSummary),

    evaluation: normalizeEvaluationArray(lessonPlanRecord.evaluation),

    exitTicket: normalizeStringArray(lessonPlanRecord.exitTicket),

    assignment: normalizeStringArray(lessonPlanRecord.assignment),
  };

  const normalizedData: GeneratedLessonData = {
    meta: {
      subject: normalizeString(meta.subject, body.subject),
      topic: normalizeString(meta.topic, body.topic),
      grade: normalizeString(meta.grade, body.grade),
      curriculum: normalizeString(meta.curriculum, curriculum),
      examAlignment: normalizeExamAlignment(meta.examAlignment, examAlignment),
      schoolLevel: normalizedSchoolLevel,
      numberOfSlides: normalizeNumber(
        meta.numberOfSlides,
        numberOfSlides,
        1,
        20
      ),
      durationMins: normalizeNumber(
        meta.durationMins,
        durationMins,
        10,
        180
      ),
      lessonType: normalizeLessonType(
        meta.lessonType,
        inferLessonType(body.subject, body.topic)
      ),
      academicDepth: normalizeAcademicDepth(
        meta.academicDepth,
        inferAcademicDepth(normalizedSchoolLevel, body.grade)
      ),
    },

    lessonPlan: normalizedLessonPlan,

    lessonNotes: normalizeLessonNotes(record.lessonNotes),

    subjectEnrichment: normalizeSubjectEnrichment(
      record.subjectEnrichment,
      body
    ),

    references: normalizeStringArray(record.references),

    slides: normalizeSlideArray(record.slides),

    quiz: {
      mcq:
        typeof record.quiz === "object" && record.quiz !== null
          ? normalizeMCQArray((record.quiz as Record<string, unknown>).mcq)
          : [],
      theory:
        typeof record.quiz === "object" && record.quiz !== null
          ? normalizeTheoryArray((record.quiz as Record<string, unknown>).theory)
          : [],
    },

    liveApplications: normalizeStringArray(record.liveApplications),
  };

  return normalizedData;
}

function validateGeneratedData(data: GeneratedLessonData): string | null {
  if (!data.lessonPlan.lessonTitle) return "Missing lesson title.";
  if (data.lessonPlan.performanceObjectives.length < 3) {
    return "Missing required performance objectives.";
  }
  if (data.lessonNotes.keyConcepts.length < 3) {
    return "Missing required lesson notes.";
  }
  if (data.slides.length !== data.meta.numberOfSlides) {
    return "Generated slide count does not match the requested slide count.";
  }
  if (data.quiz.mcq.length !== 10) return "Missing required MCQ set.";
  if (data.quiz.theory.length !== 2) return "Missing required theory questions.";
  if (data.references.length < 3) return "Missing required references.";
  return null;
}

export async function POST(req: NextRequest) {
  try {
    const auth = req.headers.get("authorization") ?? "";
    const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";

    if (!token) {
      return NextResponse.json(
        { error: "Unauthorized (no token)" },
        { status: 401 }
      );
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
        global: {
          headers: { Authorization: `Bearer ${token}` },
        },
      }
    );

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        {
          error: "Unauthorized (invalid token)",
          message: authError?.message,
        },
        { status: 401 }
      );
    }

    let body: GeneratePayload;
    try {
      body = (await req.json()) as GeneratePayload;
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    if (!body?.subject || !body?.topic || !body?.grade) {
      return NextResponse.json(
        { error: "Missing required fields: subject, topic, grade" },
        { status: 400 }
      );
    }

    const usePersonalCredits = body.usePersonalCredits === true;
    const activeRole = req.cookies.get(ROLE_COOKIE_KEY)?.value ?? null;

    const creditAvailability = await getGenerationCreditAvailability(supabase, user.id, activeRole);
    if (!creditAvailability.ok) {
      return NextResponse.json(
        {
          ok: false,
          error: "credit_check_failed",
          message: creditAvailability.error,
          upgrade_url: null,
        },
        { status: 500 }
      );
    }

    // ── 1. Check credits available ────────────────────────
    if (
      !usePersonalCredits &&
      creditAvailability.creditsRemaining < LESSON_PACK_CREDIT_COST
    ) {
      if (creditAvailability.source === "school") {
        const { data: profileData, error: profileReadError } = await supabase
          .from("profiles")
          .select("credits_balance")
          .eq("id", user.id)
          .maybeSingle();

        if (profileReadError) {
          console.error("[generate] Failed to read personal fallback credits:", {
            userId: user.id,
            cost: LESSON_PACK_CREDIT_COST,
            schoolCreditsRemaining: creditAvailability.creditsRemaining,
            error: profileReadError.message,
          });
          return NextResponse.json(
            {
              ok: false,
              error: "credit_check_failed",
              message: `Credit check failed: ${profileReadError.message}`,
              upgrade_url: null,
            },
            { status: 500 }
          );
        }

        const personalBalance = Math.max(
          0,
          Number((profileData as any)?.credits_balance ?? 0)
        );

        if (personalBalance < LESSON_PACK_CREDIT_COST) {
          return NextResponse.json(
            {
              ok: false,
              error: "school_out_of_credits",
              errorCode: "school_out_of_credits",
              message:
                "Your school has run out of credits and your personal balance is too low. Top up personal credits or contact your principal.",
              upgrade_url: "/pricing",
            },
            { status: 402 }
          );
        }
      }

      return NextResponse.json(
        {
          ok: false,
          error: "out_of_credits",
          errorCode: "out_of_credits",
          message:
            "You have used all your credits. Purchase more to continue generating lessons.",
          upgrade_url: "/pricing",
        },
        { status: 402 }
      );
    }

    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json(
        { error: "OPENAI_API_KEY missing" },
        { status: 500 }
      );
    }

    if (req.signal?.aborted) {
      return NextResponse.json(
        { error: "Request cancelled" },
        { status: 499 }
      );
    }

    const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

    console.log("🎯 Generating lesson for:", {
      subject: body.subject,
      topic: body.topic,
      grade: body.grade,
      curriculum: body.curriculum ?? "Nigerian Curriculum",
      examAlignment: body.examAlignment ?? "None",
      schoolLevel: body.schoolLevel ?? "Secondary",
      numberOfSlides: clampNumber(body.numberOfSlides, 1, 20, 8),
      durationMins: clampNumber(body.durationMins, 10, 180, 40),
    });

    // ── 2. Run OpenAI generation ──────────────────────────
    const resp = await client.responses.create({
      model: "gpt-4.1-mini",
      input: [
        {
          role: "system",
          content:
            "Return STRICT valid JSON only. No markdown. No backticks. No explanation text.",
        },
        {
          role: "user",
          content: buildUserInstructions(body),
        },
      ],
      temperature: 0.2,
      max_output_tokens: 7000,
      text: { format: { type: "json_object" } },
    });

    const raw = resp.output_text ?? "";

    // ── 3. If OpenAI fails → return error, NO credits deducted ──
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      console.error("❌ BAD JSON FROM MODEL:", raw);
      return NextResponse.json(
        { error: "Model returned invalid JSON — no credits deducted. Please try again." },
        { status: 502 }
      );
    }

    const data = normalizeGeneratedData(parsed, body);
    const validationError = validateGeneratedData(data);

    if (validationError) {
      return NextResponse.json(
        {
          error: "Generated lesson was incomplete - no credits deducted. Please try again.",
          detail: validationError,
        },
        { status: 502 }
      );
    }

    // Core generation succeeded; save before charging so failed saves never deduct credits.
    // TODO: Add staged/background image enrichment using slide imageQuery/videoQuery strings after the core lesson is saved.
    const { data: savedLesson, error: saveErr } = await supabase
      .from("lessons")
      .insert({
        user_id: user.id,
        subject: body.subject,
        topic: body.topic,
        grade: body.grade,
        curriculum: body.curriculum ?? null,
        result_json: data,
        type: "lesson",
      })
      .select("id")
      .maybeSingle();

    if (saveErr || !savedLesson) {
      console.error("[generate] Failed to save to library:", saveErr?.message);
      return NextResponse.json(
        {
          error: "Failed to save generated lesson - no credits deducted. Please try again.",
          message: saveErr?.message ?? "Lesson save returned no row.",
        },
        { status: 500 }
      );
    }

    const deductionResult = usePersonalCredits
      ? await consumePersonalCreditsDirectly(supabase, user.id, LESSON_PACK_CREDIT_COST)
      : await consumeGenerationCredits(supabase, user.id, LESSON_PACK_CREDIT_COST, activeRole);

    if (!deductionResult.ok) {
      console.error("[generate] Credit deduction failed:", {
        userId: user.id,
        cost: LESSON_PACK_CREDIT_COST,
        source: deductionResult.source,
        errorCode: deductionResult.errorCode,
        error: deductionResult.error,
      });

      const lessonId =
        typeof (savedLesson as { id?: unknown }).id === "string"
          ? (savedLesson as { id: string }).id
          : null;

      if (lessonId) {
        const { error: cleanupErr } = await createAdminClient()
          .from("lessons")
          .delete()
          .eq("id", lessonId)
          .eq("user_id", user.id);

        if (cleanupErr) {
          console.error(
            "[generate] Failed to clean up unpaid lesson:",
            cleanupErr.message
          );
        }
      }

      if (deductionResult.errorCode === "needs_personal_confirmation") {
        return NextResponse.json(
          {
            ok: false,
            errorCode: "needs_personal_confirmation",
            personalCreditsAvailable: deductionResult.personalCreditsAvailable,
            message: "Your school has run out of credits.",
            cost: LESSON_PACK_CREDIT_COST,
            saved: false,
          },
          { status: 402 }
        );
      }

      if (
        deductionResult.errorCode === "out_of_credits" ||
        deductionResult.errorCode === "school_out_of_credits"
      ) {
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
          message:
            "We generated the lesson but could not safely deduct credits, so it was not saved. Please retry. If this repeats, contact support.",
          detail: deductionResult.error,
          saved: false,
        },
        { status: 500 }
      );
    }

    const newBalance = deductionResult.creditsRemaining;
    const previousBalance = deductionResult.previousBalance;
    const savedLessonId =
      typeof (savedLesson as { id?: unknown }).id === "string"
        ? (savedLesson as { id: string }).id
        : null;

    if (savedLessonId) {
      void sendFirstGenerationEmailOnce({ userId: user.id, lessonId: savedLessonId }).catch((error) => {
        console.error("[generate] First generation email failed:", error);
      });
    }

    if (deductionResult.source === "personal" && user.email) {
      const firstName = getFirstName(
        user.user_metadata?.full_name ?? user.user_metadata?.name
      );

      if (newBalance <= 5 && newBalance > 0 && previousBalance > 5) {
        await sendEmail({
          to: user.email,
          subject: "Your LessonForge credits are running low",
          html: creditsLowEmail({
            firstName,
            creditsLeft: newBalance,
          }),
        });
      }

      if (newBalance === 0 && previousBalance > 0) {
        await sendEmail({
          to: user.email,
          subject: "You have used all your LessonForge credits",
          html: creditsFinishedEmail({ firstName }),
        });
      }
    }

    return NextResponse.json({ data, lessonId: savedLessonId, saved: true }, { status: 200 });

  } catch (err: unknown) {
    const message =
      err instanceof Error ? err.message : typeof err === "string" ? err : "Unknown error";
    console.error("❌ Generation error:", err);
    return NextResponse.json(
      { error: "Generation failed", message },
      { status: 500 }
    );
  }
}
