import OpenAI from "openai";
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

type GeneratePayload = {
  subject: string;
  topic: string;
  grade: string;
  curriculum?: string;
  examAlignment?: "None" | "WAEC" | "NECO" | string;
  schoolLevel?: "EYFS" | "Primary" | "Secondary" | string;
  numberOfSlides?: number;
  durationMins?: number;
  user_id?: string;
};

type VocabularyItem = {
  word: string;
  simpleMeaning: string;
};

type LessonStep = {
  stepNumber: number;
  stepTitle: string;
  timeMinutes: number;
  teacherActivity: string;
  learnerActivity: string;
  teachingMethod: string;
  assessmentCheck: string;
  concretisedLearningPoint: string;
};

type Differentiation = {
  supportForStrugglingLearners: string;
  supportForAverageLearners: string;
  challengeForAdvancedLearners: string;
};

type EvaluationItem =
  | string
  | {
      question: string;
      markingGuide: string;
    };

type TheoryQuestion = {
  q?: string;
  question?: string;
  markingGuide: string;
};

type MCQItem = {
  q: string;
  options: string[];
  answerIndex: number;
};

type SlideItem = {
  title: string;
  bullets: string[];
  imageQuery: string;
  videoQuery: string;
  interactivePrompt: string;
  image?: string;
};

type LessonPlan = {
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

type GeneratedLessonData = {
  meta: {
    subject: string;
    topic: string;
    grade: string;
    curriculum: string;
    examAlignment: string;
    schoolLevel: string;
    numberOfSlides: number;
    durationMins: number;
  };
  lessonPlan: LessonPlan;
  lessonNotes: string;
  references: string[];
  slides: SlideItem[];
  quiz: {
    mcq: MCQItem[];
    theory: TheoryQuestion[];
  };
  liveApplications: string[];
};

const FALLBACK_IMG =
  "https://images.unsplash.com/photo-1524995997946-a1c2e315a42f?w=1200";

function clampNumber(value: number | undefined, min: number, max: number, fallback: number) {
  if (typeof value !== "number" || Number.isNaN(value)) return fallback;
  return Math.max(min, Math.min(max, value));
}

function normalizeString(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value.trim() : fallback;
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

function normalizeEvaluationArray(value: unknown): EvaluationItem[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => {
      if (typeof item === "string" && item.trim()) {
        return item.trim();
      }

      if (typeof item === "object" && item !== null) {
        const question = normalizeString((item as Record<string, unknown>).question);
        const markingGuide = normalizeString(
          (item as Record<string, unknown>).markingGuide
        );

        if (question || markingGuide) {
          return {
            question,
            markingGuide,
          };
        }
      }

      return null;
    })
    .filter(Boolean) as EvaluationItem[];
}

function normalizeTheoryArray(value: unknown): TheoryQuestion[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => {
      if (typeof item === "object" && item !== null) {
        const q = normalizeString((item as Record<string, unknown>).q);
        const question = normalizeString((item as Record<string, unknown>).question);
        const markingGuide = normalizeString(
          (item as Record<string, unknown>).markingGuide
        );

        if (q || question || markingGuide) {
          return { q, question, markingGuide };
        }
      }
      return null;
    })
    .filter(Boolean) as TheoryQuestion[];
}

function normalizeMCQArray(value: unknown): MCQItem[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => {
      if (typeof item !== "object" || item === null) return null;

      const record = item as Record<string, unknown>;
      const q = normalizeString(record.q);
      const options = Array.isArray(record.options)
        ? record.options
            .map((opt) => (typeof opt === "string" ? opt.trim() : ""))
            .filter(Boolean)
            .slice(0, 4)
        : [];
      const answerIndex =
        typeof record.answerIndex === "number" ? record.answerIndex : 0;

      if (!q || options.length === 0) return null;

      while (options.length < 4) {
        options.push("");
      }

      return {
        q,
        options: options.slice(0, 4),
        answerIndex: Math.max(0, Math.min(3, answerIndex)),
      };
    })
    .filter(Boolean) as MCQItem[];
}

function normalizeSlideArray(value: unknown): SlideItem[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => {
      if (typeof item !== "object" || item === null) return null;

      const record = item as Record<string, unknown>;
      const title = normalizeString(record.title);
      const bullets = normalizeStringArray(record.bullets).slice(0, 6);
      const imageQuery = normalizeString(record.imageQuery);
      const videoQuery = normalizeString(record.videoQuery);
      const interactivePrompt = normalizeString(record.interactivePrompt);
      const image = normalizeString(record.image);

      return {
        title,
        bullets,
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

      const stepNumber =
        typeof record.stepNumber === "number"
          ? record.stepNumber
          : typeof record.step === "number"
          ? record.step
          : index + 1;

      const stepTitle =
        normalizeString(record.stepTitle) ||
        normalizeString(record.title) ||
        `Step ${index + 1}`;

      const timeMinutes =
        typeof record.timeMinutes === "number" && !Number.isNaN(record.timeMinutes)
          ? Math.max(1, record.timeMinutes)
          : 5;

      return {
        stepNumber,
        stepTitle,
        timeMinutes,
        teacherActivity: normalizeString(record.teacherActivity),
        learnerActivity: normalizeString(record.learnerActivity),
        teachingMethod: normalizeString(record.teachingMethod),
        assessmentCheck: normalizeString(record.assessmentCheck),
        concretisedLearningPoint: normalizeString(record.concretisedLearningPoint),
      };
    })
    .filter(Boolean) as LessonStep[];
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
    "durationMins": 40
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
        "markingGuide": ""
      }
    ],
    "exitTicket": ["..."],
    "assignment": ["..."]
  },
  "lessonNotes": "",
  "references": ["...", "...", "..."],
  "slides": [
    {
      "title": "",
      "bullets": ["", "", "", ""],
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
        "answerIndex": 0
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
- usable WITHOUT needing a textbook or external AI

========================
META (REQUIRED)
========================
- Fill ALL meta fields correctly:
  subject
  topic
  grade
  curriculum
  examAlignment (None / WAEC / NECO)
  schoolLevel (EYFS / Primary / Secondary)
  durationMins
  numberOfSlides

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
  identify, define, explain, describe, demonstrate, classify, compare, construct, solve, create, observe, present
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
  concrete/local materials (VERY IMPORTANT)

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

========================
STEP-BY-STEP LESSON DELIVERY (CRITICAL)
========================
- EXACTLY 4 to 6 steps

Each step MUST include:
- stepNumber
- stepTitle
- timeMinutes
- teacherActivity
- learnerActivity
- teachingMethod
- assessmentCheck
- concretisedLearningPoint

RULES:
- Must feel like REAL teaching flow
- timeMinutes must be realistic
- teacherActivity MUST include:
  explanation, questioning, demonstration, guided discovery, real objects, drawing, role play, etc.
- learnerActivity MUST be ACTIVE (no passive listening)
- teachingMethod must be specific (e.g. discussion, demonstration, guided discovery)
- assessmentCheck must include:
  quick checks (oral questions, mini task, board response, pair explanation, etc.)
- concretisedLearningPoint must clearly state what learners understand
- Steps must build on each other logically

========================
LESSON NOTES (VERY IMPORTANT)
========================
- 900 to 1400 words
- Must be:
  clear
  engaging
  practical
  student-friendly
  copyable into notebooks
- MUST NOT sound robotic or dry
- MUST include vivid, relatable examples

Use these exact headings in lessonNotes:
1) Introduction
2) Key Concepts
3) Worked Examples
4) Real-life Applications
5) Summary
6) Exit Ticket
7) Key Vocabulary

Lesson note rules:
- Worked Examples: MINIMUM 2, step-by-step
- Real-life Applications: MINIMUM 3, local where possible
- Summary: 5 to 8 bullet points
- Exit Ticket: EXACTLY 3 questions
- Key Vocabulary: MINIMUM 8 terms with meanings

========================
DIFFERENTIATION
========================
Must include:
- supportForStrugglingLearners
- supportForAverageLearners
- challengeForAdvancedLearners

Must be PRACTICAL and usable in class

========================
BOARD SUMMARY
========================
- 5 to 10 short points
- Must include:
  key definitions
  formulas
  steps
  core ideas
- Must be what teacher writes on the board

========================
EVALUATION
========================
- EXACTLY 5 questions
- MUST include:
  knowledge
  understanding
  application
- Each MUST include:
  question
  markingGuide

========================
EXIT TICKET
========================
- EXACTLY 3 short questions
- Quick understanding check

========================
ASSIGNMENT
========================
- EXACTLY 3 items
- Must include:
  practice
  real-life connection
  extension/challenge

========================
SLIDES
========================
- EXACTLY ${numberOfSlides} slides

Each slide MUST include:
- title
- bullets (4 to 6 only)
- imageQuery
- videoQuery
- interactivePrompt

Rules:
- Bullets must be SHORT and PRESENTATION-READY
- NOT copied from lesson notes
- MUST be interactive

Include a healthy mix of:
- starter
- discussion
- think-pair-share
- quick check
- demonstration
- recap

========================
QUIZ
========================
MCQ:
- EXACTLY 10 questions
- Each:
  q
  options (4)
  answerIndex (0–3)

Theory:
- EXACTLY 2 questions
- Each must include markingGuide

Must be level-appropriate and exam-aware

========================
LIVE APPLICATIONS
========================
- 3 to 5 items
- Must show real-world use:
  home, school, industry, transport, agriculture, health, etc.

========================
REFERENCES
========================
- 3 to 5 items
- Must be REALISTIC textbooks or curriculum guides
- No fake details

========================
LEVEL ADAPTATION
========================
EYFS:
- playful, visual, simple, concrete
- use songs, objects, pictures, movement, imitation, tracing, matching, colouring, naming
- avoid abstract explanation

PRIMARY:
- simple, vivid, relatable
- use familiar examples from home, school, playground, market, family, weather, animals, food, transport
- encourage observation, drawing, discussion, and guided practice

SECONDARY:
- structured, exam-aware, deeper reasoning
- clear, practical, and classroom-usable
- include stronger reasoning, comparison, examples, and application

========================
CURRICULUM & EXAM ADAPTATION
========================
- Nigerian Curriculum → practical, teacher-friendly, classroom-usable
- Cambridge → inquiry-based, skill-focused, conceptually clear

- If examAlignment = WAEC or NECO:
  - MUST be exam-conscious
  - Use structured phrasing
  - Include exam-style questions where appropriate

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
This lesson must be so complete that:
A teacher can teach directly from it WITHOUT needing a textbook or ChatGPT.

Return VALID JSON only.
`.trim();
}

async function generateSlideImage(
  client: OpenAI,
  params: {
    subject: string;
    topic: string;
    schoolLevel?: string;
    curriculum?: string;
    examAlignment?: string;
    slideTitle?: string;
    imageQuery?: string;
  }
): Promise<string | null> {
  try {
    const prompt = `
Create a clean educational illustration for a lesson slide.

Subject: ${params.subject}
Topic: ${params.topic}
School Level: ${params.schoolLevel ?? "Secondary"}
Curriculum: ${params.curriculum ?? "Nigerian Curriculum"}
Exam Alignment: ${params.examAlignment ?? "None"}
Slide Title: ${params.slideTitle ?? ""}
Image Focus: ${params.imageQuery ?? params.topic}

Requirements:
Create a high-quality educational image strictly based on the exact lesson concept, topic, subject, and school level provided.

The image must actively teach the concept, not merely decorate it.

STRICT STYLE CONSTRAINTS:
- The image must NOT appear cartoonish, childish, playful, entertainment-style, exaggerated, or heavily stylized.
- The image must resemble a textbook diagram, classroom teaching aid, scientific illustration, academic concept visual, or professional educational poster.
- If the output looks decorative, cartoon-like, or unserious, it is incorrect.

CORE EDUCATIONAL GOAL:
- The image must clearly improve understanding of the lesson.
- It must visually explain the concept in a way that supports teaching and learning.
- Prioritize educational clarity, concept accuracy, and instructional value over artistic beauty.
- Avoid vague, generic, or decorative visuals.

CONTENT ACCURACY:
- The image must be strictly relevant to the exact lesson concept.
- Avoid irrelevant objects, unrelated backgrounds, unnecessary decoration, or distracting elements.
- Only include people if they are directly necessary to explain the concept.
- Avoid random human figures or stock-photo style scenes unless a real-life scene is truly the best educational choice.

IMAGE FORMAT PREFERENCE:
Choose the most educationally effective image format for the topic, such as:
- labeled diagram
- annotated concept illustration
- process visual
- apparatus or specimen visual
- realistic subject illustration
- structured academic scene

Do NOT generate an image that is merely attractive. Generate one that actively teaches.

LABELING AND INSTRUCTIONAL DESIGN:
- For science, biology, chemistry, physics, geography, technology, mathematics, business, economics, accounting, and other concept-heavy subjects, prefer labeled educational diagrams over decorative illustrations.
- Include labels when they improve understanding, such as:
  - names of parts
  - arrows pointing to structures
  - short concept markers
  - stage indicators
  - simple section names
  - logical callouts
- If the concept has structures, parts, stages, formulas, relationships, functions, tools, or processes, visually show them clearly.
- Labels must be accurate, readable, well-placed, concise, and educationally meaningful.
- Do not use long paragraphs inside the image.
- If the image explains a process, show the flow clearly using arrows, sequence markers, or short step annotations.

TEXT INSIDE IMAGE:
- Only include text when it directly improves learning.
- Allowed text includes:
  - labels
  - part names
  - arrows
  - short process markers
  - short educational callouts
- Do not include unrelated text, decorative text, long explanations, or unnecessary writing.

RENDERING STYLE:
- Use clean, precise lines and clear visual structure.
- Use realistic proportions where applicable.
- Use balanced, minimal, and academic color usage.
- Prefer neutral, natural, or educational tones rather than playful palettes.
- For real-world scenes, use realistic lighting and textures.
- For diagrams, use clean and flat academic rendering.
- Avoid glossy cartoon rendering, 3D animated style, Pixar-like style, comic-book style, or playful children’s illustration style.

COMPOSITION AND LAYOUT:
- Keep the main subject clear and central.
- Ensure good spacing between key elements.
- Avoid clutter.
- Maintain strong focus on the lesson concept.
- Make the image presentation-ready for classroom teaching, slides, worksheets, notes, and school materials.

SCHOOL-LEVEL STYLE GUIDANCE:
- If School Level is EYFS / Nursery:
  Use simple, clean, realistic educational visuals with clear subject focus.
  Avoid cartoon style, playful illustration, exaggerated features, or childish design.
  Use real-world objects, realistic representations, natural proportions, and professional educational clarity.
  Keep the composition simple and easy to understand, but still serious and classroom-appropriate.

- If School Level is Primary:
  Use clear, structured, slightly simplified realistic educational visuals.
  Keep the image easy for children to understand, but avoid cartoon, decorative, or unserious styles.
  Maintain neat composition and academic clarity.

- If School Level is Secondary:
  Use mature, realistic, textbook-quality diagrams, academic illustrations, or structured concept visuals.
  Include richer labels, clearer annotations, and more detailed instructional support where helpful.

QUALITY AND USABILITY RULES:
- The image must be classroom-safe, education-focused, and genuinely useful for teaching.
- The image must look intentional, clear, and presentation-ready.
- The image must support lesson understanding, not just visual appeal.
- No watermarks.
- No unrelated text.
- No irrelevant decorative background.
- No random people.
- No childish design.
- No cartoon style.
- No entertainment-style illustration.

FINAL STANDARD:
The final image should feel like something a teacher would confidently use in class, include in a worksheet, add to a lesson note, or present in a professional school slide.

If the image does not clearly teach the concept, then it is not acceptable.
`.trim();

    const imageResp = await client.images.generate({
      model: "gpt-image-1",
      prompt,
      size: "1536x1024",
      quality: "medium",
    });

    const b64 = imageResp?.data?.[0]?.b64_json;
    if (!b64 || typeof b64 !== "string") return null;

    return `data:image/png;base64,${b64}`;
  } catch (error) {
    console.error("❌ OpenAI image generation failed:", error);
    return null;
  }
}

function normalizeGeneratedData(rawData: unknown, body: GeneratePayload): GeneratedLessonData {
  const curriculum = body.curriculum ?? "Nigerian Curriculum";
  const examAlignment = body.examAlignment ?? "None";
  const schoolLevel = body.schoolLevel ?? "Secondary";
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
      examAlignment: normalizeString(meta.examAlignment, examAlignment),
      schoolLevel: normalizeString(meta.schoolLevel, schoolLevel),
      numberOfSlides:
        typeof meta.numberOfSlides === "number"
          ? clampNumber(meta.numberOfSlides, 1, 20, numberOfSlides)
          : numberOfSlides,
      durationMins:
        typeof meta.durationMins === "number"
          ? clampNumber(meta.durationMins, 10, 180, durationMins)
          : durationMins,
    },

    lessonPlan: normalizedLessonPlan,

    lessonNotes: normalizeString(record.lessonNotes),

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

    const { data: creditData, error: creditErr } =
      await supabase.rpc("consume_generation_credit");

    if (creditErr) {
      return NextResponse.json(
        { error: "Credit check failed", detail: creditErr.message },
        { status: 500 }
      );
    }

    if (!user.email_confirmed_at) {
      return NextResponse.json(
        { error: "Please confirm your email before generating lessons." },
        { status: 403 }
      );
    }

    if (!creditData?.ok) {
      const msg = creditData?.error || "No credits";
      const status =
        typeof msg === "string" && msg.toLowerCase().includes("not authenticated")
          ? 401
          : 402;

      return NextResponse.json({ error: msg }, { status });
    }

    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json(
        { error: "OPENAI_API_KEY missing" },
        { status: 500 }
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

    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      console.error("❌ BAD JSON FROM MODEL:", raw);
      return NextResponse.json(
        { error: "Model returned invalid JSON" },
        { status: 502 }
      );
    }

    const data = normalizeGeneratedData(parsed, body);

    if (Array.isArray(data.slides) && data.slides.length > 0) {
      for (let i = 0; i < data.slides.length; i++) {
        const slide = data.slides[i];

        const imageFocus =
          slide.imageQuery ||
          slide.title ||
          body.topic;

        const generatedImage = await generateSlideImage(client, {
          subject: body.subject,
          topic: body.topic,
          schoolLevel: body.schoolLevel,
          curriculum: body.curriculum,
          examAlignment: body.examAlignment,
          slideTitle: slide.title,
          imageQuery: String(imageFocus),
        });

        slide.image = generatedImage || FALLBACK_IMG;
      }
    }

    return NextResponse.json({ data }, { status: 200 });
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