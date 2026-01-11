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
You are an expert teacher and instructional designer.

Generate a COMPLETE lesson pack as valid JSON only (no markdown, no extra text).
Audience: Grade ${input.grade}
Subject: ${input.subject}
Topic: ${input.topic}
Curriculum: ${curriculum}
Duration: ${durationMins} minutes

Return JSON with this exact shape:
{
  "meta": {
    "subject": string,
    "topic": string,
    "grade": string,
    "curriculum": string,
    "durationMins": number
  },
  "objectives": string[],
  "lessonNotes": string,
  "slides": {
    "title": string,
    "bullets": string[],
    "imageQuery": string,
    "videoQuery": string,
    "interactivePrompt": string
  }[],
  "quiz": {
    "mcq": { "question": string, "options": string[], "answerIndex": number }[],
    "theory": { "question": string, "markingGuide": string }[]
  },
  "liveApplications": string[]
}

Rules:
- Age-appropriate
- Nigeria-friendly examples where relevant
- 10 MCQs, 2 theory questions
- 8–12 slides
- STRICT JSON ONLY
`;
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as GeneratePayload;

    if (!body.subject || !body.topic || !body.grade) {
      return Response.json({ error: "Missing fields" }, { status: 400 });
    }

    const client = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });

    const resp = await client.responses.create({
      model: "gpt-4.1-mini",
      input: buildPrompt(body),
    });

    const text = resp.output_text || "";

    const data = JSON.parse(text);

    return Response.json({ data });
  } catch (err: any) {
    return Response.json(
      { error: "Generation failed", details: String(err) },
      { status: 500 }
    );
  }
}
