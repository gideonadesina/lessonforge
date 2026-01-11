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
  "keyVocabulary": { "term": string, "meaning": string }[],
  "lessonPlan": {
    "starter": string,
    "mainTeaching": string[],
    "guidedPractice": string[],
    "independentPractice": string,
    "assessment": string,
    "differentiation": string[],
    "materials": string[]
  },
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
- Make it age-appropriate and clear.
- Use Nigeria-friendly examples when helpful (markets, local industries, daily life).
- Provide 10 MCQs and 2 theory questions.
- Slides should be 8–12 slides.
- For each slide, provide strong "imageQuery" and "videoQuery" for later media embedding.
- Output must be STRICT JSON (parsable).
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
        { error: "OPENAI_API_KEY is not set in .env.local" },
        { status: 500 }
      );
    }

    const client = new OpenAI({ apiKey });

    const prompt = buildPrompt(body);

    // NOTE: Model name can be adjusted later.
    const resp = await client.responses.create({
      model: "gpt-4.1-mini",
      input: prompt,
    });

    const text =
      resp.output_text ??
      "";

    // Try parse JSON
    let data: any;
    try {
      data = JSON.parse(text);
    } catch {
      return Response.json(
        {
          error: "Model returned non-JSON. Try again.",
          raw: text.slice(0, 2000),
        },
        { status: 502 }
      );
    }

    return Response.json({ data }, { status: 200 });
  } catch (err: any) {
    return Response.json(
      { error: "Server error", details: String(err?.message ?? err) },
      { status: 500 }
    );
  }
}
