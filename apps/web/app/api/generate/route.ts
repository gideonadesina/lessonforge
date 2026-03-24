import OpenAI from "openai";
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { consumeGenerationCredit } from "@/lib/credits/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

type GeneratePayload = {
  subject: string;
  topic: string;
  grade: string;
  curriculum?: string;
  schoolLevel?: string;
  numberOfSlides?: number;
  durationMins?: number;
  user_id?: string;
};
const FALLBACK_IMG =
  "https://images.unsplash.com/photo-1524995997946-a1c2e315a42f?w=1200";

function buildUserInstructions(input: GeneratePayload) {
  const curriculum = input.curriculum ?? "General (Nigeria-friendly)";
  const durationMins = input.durationMins ?? 40;
  const schoolLevel = input.schoolLevel ?? "Secondary";
  const numberOfSlides = Math.max(1, Math.min(20, input.numberOfSlides ?? 8));

  return `
Return STRICT JSON only. No markdown. No backticks. No extra text.

Audience:
- School Level: ${schoolLevel}
- Class / Grade: ${input.grade}
- Subject: ${input.subject}
- Topic: ${input.topic}
- Curriculum: ${curriculum}
- Duration: ${durationMins} minutes
- Number of Slides: ${numberOfSlides}

You MUST output JSON with exactly this shape:
{
  "meta": {
    "subject": "",
    "topic": "",
    "grade": "",
    "curriculum": "",
    "schoolLevel": "",
    "numberOfSlides": 8,
    "durationMins": 40
  },
  "lessonPlan": {
    "title": "",
    "performanceObjectives": ["..."],
    "instructionalMaterials": ["..."],
    "previousKnowledge": "",
    "introduction": "",
    "steps": [
      {
        "step": 1,
        "title": "",
        "teacherActivity": "",
        "learnerActivity": "",
        "concretisedLearningPoint": ""
      }
    ],
    "evaluation": ["..."],
    "assignment": ["..."],
    "realLifeConnection": ["..."]
  },
  "objectives": ["..."],
  "lessonNotes": "....",
  "references": ["...", "...", "..."]
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
        "q": "What is photosynthesis?",
        "options": [
          "Process plants use to make food",
          "Animal respiration",
          "Water absorption",
          "Soil formation"
        ],
        "answerIndex": 0
      }
    ],
    "theory": [
      { "q": "Explain ...", "markingGuide": "..." }
    ]
  },
  "liveApplications": ["..."]
}

Hard requirements:

META
- Fill all meta fields correctly.

LESSON PLAN (VERY IMPORTANT)
- lessonPlan MUST come first in the educational flow and must be practical, systematic, classroom-ready, and concretised.
- performanceObjectives: exactly 5 to 7 objectives.
- Each objective MUST start with a strong action verb such as:
  identify, mention, explain, demonstrate, dramatise, construct, classify, compare, present, observe, draw, solve, describe, create.
- Objectives must be learner-centred and measurable.
- instructionalMaterials: 5 to 10 relevant materials, including concrete/local materials where possible.
- previousKnowledge: 1 short paragraph linking to what learners already know.
- introduction: 1 short paragraph that hooks learners using familiar, real-life, local, or classroom situations.
- steps: exactly 4 to 6 steps.
- Every step MUST include:
  * step number
  * title
  * teacherActivity
  * learnerActivity
  * concretisedLearningPoint
- teacherActivity MUST show practical teaching: demonstration, questioning, guided discovery, use of real objects, role play/dramatisation, drawing/sketching, construction, presentation, observation, or outdoor/environment connection where relevant.
- learnerActivity MUST be active, not passive.
- concretisedLearningPoint must be simple and direct, showing what learners should grasp from that step.
- evaluation: exactly 5 items.
- assignment: exactly 3 items.
- realLifeConnection: 3 to 5 items that connect learning to life outside the classroom, home, market, farm, road, health, environment, church/mosque, or community where relevant.

OBJECTIVES
- objectives: 6 to 10 items.
- Keep them aligned with the lesson plan and measurable.
- Use action verbs and classroom outcomes.

LESSON NOTES (VERY IMPORTANT)
- 900 to 1400 words.
- Must be highly concretised, interesting, and student-friendly so learners can copy it into their notebooks.
- Use simple but intelligent classroom language.
- Avoid dry textbook style.
- Use examples learners can picture easily.
- Include familiar Nigeria-friendly or locally relevant illustrations where appropriate.
- The lesson note must feel like a real teacher wrote it for actual students.
- Use these plain-text headings exactly:
  1) Introduction
  2) Key Concepts
  3) Worked Examples (at least 2, step-by-step)
  4) Common Misconceptions (at least 3) + corrections
  5) Real-life Applications (at least 3, Nigeria-friendly where possible)
  6) Summary (5–8 bullet points)
  7) Exit Ticket (3 short questions)
  8) Key Vocabulary (at least 8 terms with meanings)

  REFERENCES
- references: 3 to 6 items.
- Include recommended textbooks, curriculum documents, or recognized school resources relevant to the subject and level.
- Use familiar school textbook names where appropriate.
- Do not invent page numbers, edition details, or publisher data unless certain.
- Keep references practical and teacher-friendly.

SLIDES
- slides: EXACTLY ${numberOfSlides} slides.
- Each slide bullets: 4 to 6 bullets only.
- Bullets must be short, clear, learner-friendly, and presentation-ready.
- Slides should not look like copied paragraphs from lesson notes.
- Slides MUST be interactive and engaging.
- Across the slide deck, include a healthy mix of:
  * warm-up / starter question
  * observation task
  * think-pair-share
  * mini class discussion
  * quick checkpoint
  * demonstration cue
  * role play / dramatization cue where relevant
  * practical / real-life connection
  * short recap
- each slide MUST include:
  * imageQuery: a short descriptive search phrase for an educational image or illustration
  * videoQuery: search terms for educational videos
  * interactivePrompt: a specific engaging learner task, question, or mini activity

QUIZ
- quiz.mcq: exactly 10 multiple choice questions.
- Each MCQ MUST have:
  * q
  * options: EXACTLY 4 option strings
  * answerIndex: number 0 to 3
- Questions should range from easy to moderate, suitable for ${schoolLevel} / ${input.grade}.
- quiz.theory: exactly 2 questions, each with a markingGuide.

LIVE APPLICATIONS
- liveApplications: 3 to 6 items.
- Must show practical, real-world use of the concept.

LEVEL ADAPTATION
- If School Level is EYFS / Nursery:
  * use playful, concrete, very simple language
  * use songs, objects, pictures, movement, imitation, tracing, matching, colouring, naming
  * avoid abstract explanations
- If School Level is Primary:
  * keep language simple and vivid
  * use familiar examples from home, class, playground, market, family, weather, animals, food, transport
  * encourage observation, drawing, discussion, and guided practice
- If School Level is Secondary:
  * use more mature language and deeper explanation
  * keep it clear, structured, exam-aware, and still practical
  * include stronger reasoning, comparison, examples, and application

CURRICULUM ADAPTATION
- If curriculum is WAEC or NECO:
  * make it exam-conscious, clear, structured, and syllabus-friendly
- If curriculum is Cambridge:
  * make it inquiry-based, skill-focused, and conceptually clear
- If curriculum is Nigerian Curriculum:
  * make it teacher-friendly, practical, and classroom-usable

Keep the whole output classroom-ready, curriculum-aware, and Nigeria-relevant.

Return JSON only.
`.trim();
}

async function generateSlideImage(
  client: OpenAI,
  params: {
    subject: string;
    topic: string;
    schoolLevel?: string;
    curriculum?: string;
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
Slide Title: ${params.slideTitle ?? ""}
Image Focus: ${params.imageQuery ?? params.topic}

Requirements:
- classroom safe
- education-focused
- mature academic style
- realistic educational illustration or textbook-style diagram
- visually clear and presentation-ready
- relevant to the exact lesson concept
- suitable for teachers and school presentations
- avoid cartoon style
- avoid childish design
- avoid random people
- avoid stock photo look unless truly necessary
- no watermarks
- minimal text inside the image (only if it adds educational value, e.g., labels in a diagram) 
Additional style guidance:
- If School Level is EYFS / Nursery, use simple, bright, child-friendly educational visuals.
- If School Level is Primary, use clear educational visuals that are friendly but not cartoonish.
- If School Level is Secondary, use mature, realistic, textbook-style diagrams or academic illustrations. 
`;

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
export async function POST(req: NextRequest) {
  try {
    const auth = req.headers.get("authorization") ?? "";
    const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";

    if (!token) {
      return NextResponse.json({ error: "Unauthorized (no token)" }, { status: 401 });
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
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: "Unauthorized (invalid token)", message: authError?.message },
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

    if (!user?.email_confirmed_at) {
      return NextResponse.json(
        { error: "Please confirm your email before generating lessons." },
        { status: 403 }
      );
    }

    const creditResult = await consumeGenerationCredit(supabase, user.id);
    if (!creditResult.ok) {
      const msg = creditResult.error || "No credits";
      const status = msg.toLowerCase().includes("not authenticated") ? 401 : 402;
      return NextResponse.json({ error: msg }, { status });
    }

    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json(
        { error: "OPENAI_API_KEY missing" },
        { status: 500 }
      );
    }

    const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

    console.log("🎯 Generating lesson for:", body.topic);

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

    let data: any;

    try {
      data = JSON.parse(raw);
    } catch (e) {
      console.error("❌ BAD JSON FROM MODEL:", raw);

      return NextResponse.json(
        { error: "Model returned invalid JSON" },
        { status: 502 }
      );
    }

    data.meta ??= {};
    data.meta.subject ??= body.subject;
    data.meta.topic ??= body.topic;
    data.meta.grade ??= body.grade;
    data.meta.curriculum ??= body.curriculum ?? "General (Nigeria-friendly)";
    data.meta.schoolLevel ??= body.schoolLevel ?? "Secondary";
    data.meta.numberOfSlides ??= body.numberOfSlides ?? 8;
    data.meta.durationMins ??= body.durationMins ?? 40;

    data.lessonPlan ??= {
      title: `${body.subject} - ${body.topic}`,
      performanceObjectives: data.objectives ?? [],
      instructionalMaterials: [],
      previousKnowledge: "",
      introduction: "",
      steps: [],
      evaluation: [],
      assignment: [],
      realLifeConnection: [],
    };

    data.objectives ??= [];
    data.lessonNotes ??= "";
    data.slides ??= [];
    data.quiz ??= {};
    data.quiz.mcq ??= [];
    data.quiz.theory ??= [];
    data.liveApplications ??= [];

    if (Array.isArray(data.slides) && data.slides.length > 0) {
      for (let i = 0; i < data.slides.length; i++) {
        const slide = data.slides[i];

        const q =
          slide.imageQuery ||
          slide.image_prompt ||
          slide.title ||
          slide.heading ||
          slide.subtitle ||
          slide.topic ||
          body.topic;
const generatedImage = await generateSlideImage(client, {
  subject: body.subject,
  topic: body.topic,
  schoolLevel: body.schoolLevel,
  curriculum: body.curriculum,
  slideTitle: slide.title,
  imageQuery: String(q),
});

slide.image = generatedImage || FALLBACK_IMG;
      }
    }

    return NextResponse.json({ data }, { status: 200 });
  } catch (err: any) {
    console.error("❌ Generation error:", err);
    return NextResponse.json(
      { error: "Generation failed", message: err?.message ?? String(err) },
      { status: 500 }
    );
  }
}