import OpenAI from "openai";

export const runtime = "nodejs";

type GeneratePayload = {
  subject: string;
  topic: string;
  grade: string;
  curriculum?: string;
  durationMins?: number;
};

function buildPrompt(input: GeneratePayload) {
  const curriculum = input.curriculum ?? "General (Nigeria-friendly)";
  const durationMins = input.durationMins ?? 40;

  return `
Return STRICT JSON only. No markdown. No backticks. No extra text.

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
  "slides": [{ "title": "", "bullets": [], "imageQuery": "", "videoQuery": "", "interactivePrompt": "" }],
  "quiz": {
    "mcq": [{ "question": "", "options": ["","","",""], "answerIndex": 0 }],
    "theory": [{ "question": "", "markingGuide": "" }]
  },
  "liveApplications": []
}
Rules: 8–12 slides, 10 MCQs, 2 theory.
`;
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
      return Response.json(
        { error: "OPENAI_API_KEY missing in apps/web/.env.local" },
        { status: 500 }
      );
    }

    const client = new OpenAI({ apiKey });

    const resp = await client.responses.create({
      model: "gpt-4.1-mini",
      input: buildPrompt(body),
      temperature: 0.2,
    });

    const raw = resp.output_text ?? "";

    // Don’t crash if non-JSON; return it for debugging
    try {
      const data = JSON.parse(raw);
      return Response.json({ data }, { status: 200 });
    } catch {
      return Response.json(
        { error: "Non-JSON from model", rawPreview: raw.slice(0, 1500) },
        { status: 502 }
      );
    }
  } catch (err: any) {
    const status = err?.status || err?.response?.status || 500;
    const message =
      err?.message ||
      err?.response?.data?.error?.message ||
      String(err);

    return Response.json(
      { error: "Generation failed", status, message },
      { status }
    );
  }
}
console.log("KEY starts with:", (process.env.OPENAI_API_KEY || "").slice(0, 6));
