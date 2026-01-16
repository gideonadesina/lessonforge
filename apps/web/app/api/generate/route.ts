import OpenAI from "openai";

export const runtime = "nodejs";

type GeneratePayload = {
  subject: string;
  topic: string;
  grade: string;
  curriculum?: string;
  durationMins?: number;
};

const lessonPackJsonSchema = {
  name: "LessonPack",
  schema: {
    type: "object",
    additionalProperties: false,
    properties: {
      meta: {
        type: "object",
        additionalProperties: false,
        properties: {
          subject: { type: "string" },
          topic: { type: "string" },
          grade: { type: "string" },
          curriculum: { type: "string" },
          durationMins: { type: "number" },
        },
        required: ["subject", "topic", "grade", "curriculum", "durationMins"],
      },
      objectives: { type: "array", items: { type: "string" } },
      lessonNotes: { type: "string" },
     slides: {
  type: "array",
  items: {
    type: "object",
    additionalProperties: false,
    properties: {
      title: { type: "string" },
      bullets: {
        type: "array",
        items: { type: "string" },
        minItems: 4,
        maxItems: 8
      },
      imageQuery: {
        type: "string",
        description: "Human-readable image description"
      },
      imageKeywords: {
        type: "array",
        minItems: 2,
        maxItems: 5,
        items: { type: "string" }
      },
      videoQuery: { type: "string" },
      interactivePrompt: { type: "string" }
    },
    required: [
      "title",
      "bullets",
      "imageQuery",
      "imageKeywords",
      "videoQuery",
      "interactivePrompt"
    ]
  }
},
      quiz: {
        type: "object",
        additionalProperties: false,
        properties: {
          mcq: {
            type: "array",
            items: {
              type: "object",
              additionalProperties: false,
              properties: {
                question: { type: "string" },
                options: {
                  type: "array",
                  minItems: 4,
                  maxItems: 4,
                  items: { type: "string" },
                },
                answerIndex: { type: "number", minimum: 0, maximum: 3 },
              },
              required: ["question", "options", "answerIndex"],
            },
          },
          theory: {
            type: "array",
            minItems: 2,
            maxItems: 2,
            items: {
              type: "object",
              additionalProperties: false,
              properties: {
                question: { type: "string" },
                markingGuide: { type: "string" },
              },
              required: ["question", "markingGuide"],
            },
          },
        },
        required: ["mcq", "theory"],
      },
      liveApplications: { type: "array", items: { type: "string" } },
    },
    required: ["meta", "objectives", "lessonNotes", "slides", "quiz", "liveApplications"],
  },
};

function buildUserInstructions(input: GeneratePayload) {
  const curriculum = input.curriculum ?? "General (Nigeria-friendly)";
  const durationMins = input.durationMins ?? 40;

  return `
Return STRICT JSON only. No markdown. No backticks. No extra text.

Audience: Grade ${input.grade}
Subject: ${input.subject}
Topic: ${input.topic}
Curriculum: ${curriculum}
Duration: ${durationMins} minutes

Hard requirements:
- Slides: 8–12 slides.
- Each slide: 4–8 bullets; short and student-friendly.
- Each slide MUST include: imageQuery, videoQuery, interactivePrompt (non-empty).
- MCQ: exactly 10 questions; exactly 4 options; answerIndex 0–3.
- Theory: exactly 2 questions with markingGuide.
- imageKeywords: 2–5 simple nouns suitable for stock photos (e.g. "students classroom", "solar energy diagram", "water cycle illustration").


LessonNotes requirements:
- Minimum 700 words (do NOT write less).
- Use headings (plain text):
  1) Introduction
  2) Key Concepts
  3) Worked Examples (at least 2, step-by-step)
  4) Common Misconceptions (at least 3) + corrections
  5) Real-life Applications (at least 3, Nigeria-friendly where possible)
  6) Summary (5–8 bullet points)
  7) Homework/Practice (10 questions)
  8) Write teacher-ready notes (what to say + what learners do)
  9) Include at least 6 key vocabulary terms with meanings
  10) Include differentiation (support/core/stretch)
  11) Include an exit ticket (3 short questions)
  12)Use Nigeria-friendly examples where possible (still Cambridge/WAEC friendly)

Output JSON must match schema.
`.trim();
}

function extractFirstJsonObject(text: string): string | null {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) return null;
  return text.slice(start, end + 1);
}

function asString(x: any, fallback = ""): string {
  return typeof x === "string" ? x : fallback;
}
function asStringArray(x: any): string[] {
  if (!Array.isArray(x)) return [];
  return x.map((v) => String(v ?? "").trim()).filter(Boolean);
}

function sanitize(data: any, body: GeneratePayload) {
  const curriculum = body.curriculum ?? "General (Nigeria-friendly)";
  const durationMins = body.durationMins ?? 40;

  const meta = {
    subject: asString(data?.meta?.subject, body.subject),
    topic: asString(data?.meta?.topic, body.topic),
    grade: asString(data?.meta?.grade, body.grade),
    curriculum: asString(data?.meta?.curriculum, curriculum),
    durationMins: Number(data?.meta?.durationMins ?? durationMins),
  };

  const slidesRaw = Array.isArray(data?.slides) ? data.slides : [];
  const slides = slidesRaw.slice(0, 12).map((s: any) => ({
    title: asString(s?.title, "Slide"),
    bullets: asStringArray(s?.bullets).slice(0, 8),
    imageQuery: asString(s?.imageQuery, ""),
    videoQuery: asString(s?.videoQuery, ""),
    interactivePrompt: asString(s?.interactivePrompt, ""),
  }));

  const mcqRaw = Array.isArray(data?.quiz?.mcq) ? data.quiz.mcq : [];
  const mcq = mcqRaw.slice(0, 10).map((q: any) => {
    const opts = Array.isArray(q?.options) ? q.options.map(String) : [];
    const fixed = [
      asString(opts[0], "Option A"),
      asString(opts[1], "Option B"),
      asString(opts[2], "Option C"),
      asString(opts[3], "Option D"),
    ] as [string, string, string, string];

    let ai = Number(q?.answerIndex ?? 0);
    if (![0, 1, 2, 3].includes(ai)) ai = 0;

    return { question: asString(q?.question, "Question"), options: fixed, answerIndex: ai };
  });

  const theoryRaw = Array.isArray(data?.quiz?.theory) ? data.quiz.theory : [];
  const theory = theoryRaw.slice(0, 2).map((t: any) => ({
    question: asString(t?.question, "Theory question"),
    markingGuide: asString(t?.markingGuide, ""),
  }));

  return {
    meta,
    objectives: asStringArray(data?.objectives).slice(0, 12),
    lessonNotes: asString(data?.lessonNotes, ""),
    slides,
    quiz: { mcq, theory },
    liveApplications: asStringArray(data?.liveApplications).slice(0, 8),
  };
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as GeneratePayload;

    if (!body?.subject || !body?.topic || !body?.grade) {
      return Response.json(
        { error: "Missing required fields: subject, topic, grade" },
        { status: 400 }
      );
    }

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return Response.json({ error: "OPENAI_API_KEY missing" }, { status: 500 });
    }

    const client = new OpenAI({ apiKey });

    // ✅ Use schema mode at runtime; cast to any so TS doesn't block you.
    const params: any = {
      model: "gpt-4.1-mini",
      input: [
        {
          role: "system",
          content: "Return strictly valid JSON only. Do not include any extra text.",
        },
        { role: "user", content: buildUserInstructions(body) },
      ],
      temperature: 0.3,
      max_output_tokens: 2500,
      response_format: {
        type: "json_schema",
        json_schema: lessonPackJsonSchema,
      },
    };

    const resp = await client.responses.create(params);
    const raw = resp.output_text ?? "";

   
    try {
      const parsed = JSON.parse(raw);
      const data = sanitize(parsed, body);
      return Response.json({ data }, { status: 200 });
    } catch {
      const extracted = extractFirstJsonObject(raw);
      if (!extracted) {
        return Response.json(
          { error: "Non-JSON from model", rawPreview: raw.slice(0, 1500) },
          { status: 502 }
        );
      }
      try {
        const parsed = JSON.parse(extracted);
        const data = sanitize(parsed, body);
        return Response.json({ data }, { status: 200 });
      } catch {
        return Response.json(
          { error: "Invalid JSON from model", rawPreview: raw.slice(0, 1500) },
          { status: 502 }
        );
      }
    }
  } catch (err: any) {
    const status = err?.status || err?.response?.status || 500;
    const message = err?.message || err?.response?.data?.error?.message || String(err);
    return Response.json({ error: "Generation failed", status, message }, { status });
  }
}

