import OpenAI from "openai";

export const runtime = "nodejs";

type GeneratePayload = {
  subject: string;
  topic: string;
  grade: string;
  curriculum?: string;
  durationMins?: number;
};

function buildUserInstructions(input: GeneratePayload) {
  const curriculum = input.curriculum ?? "General (Nigeria-friendly)";
  const durationMins = input.durationMins ?? 40;

  return `
Return STRICT JSON only. No markdown. No backticks. No explanations.

Audience: Grade ${input.grade}
Subject: ${input.subject}
Topic: ${input.topic}
Curriculum: ${curriculum}
Duration: ${durationMins} minutes

JSON shape:
{
  "meta": { "subject": "", "topic": "", "grade": "", "curriculum": "", "durationMins": 40 },
  "objectives": [],
  "lessonNotes": "",
  "slides": [
    {
      "title": "",
      "bullets": [],
      "imageQuery": "",
      "videoQuery": "",
      "interactivePrompt": ""
    }
  ],
  "quiz": {
    "mcq": [
      { "question": "", "options": ["","","",""], "answerIndex": 0 }
    ],
    "theory": [
      { "question": "", "markingGuide": "" }
    ]
  },
  "liveApplications": []
}

Rules:
- 8–12 slides
- 10 MCQs, 2 theory
- LessonNotes must be 900–1200 words
- Use Nigeria-friendly examples
`.trim();
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as GeneratePayload;

    if (!body.subject || !body.topic || !body.grade) {
      return Response.json(
        { error: "Missing subject, topic, or grade" },
        { status: 400 }
      );
    }

    if (!process.env.OPENAI_API_KEY) {
      return Response.json(
        { error: "OPENAI_API_KEY missing" },
        { status: 500 }
      );
    }

    const client = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });

    const resp = await client.responses.create({
      model: "gpt-4.1-mini",
      input: buildUserInstructions(body),
      temperature: 0.3,
      max_output_tokens: 6000,
      text: { format: { type: "json_object" } },
    });

    const raw = resp.output_text;

    if (!raw) {
      return Response.json(
        { error: "Empty response from model" },
        { status: 502 }
      );
    }

    const parsed = JSON.parse(raw);
    return Response.json({ data: parsed }, { status: 200 });

  } catch (err: any) {
    return Response.json(
      {
        error: "Generation failed",
        message: err?.message ?? String(err),
      },
      { status: 500 }
    );
  }
}
