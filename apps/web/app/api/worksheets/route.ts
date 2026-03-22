import OpenAI from "openai";
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

type ContentMode = "normal" | "diagram" | "coloring" | "practical";

type WorksheetVisual = {
  label: string;
  imageDataUrl: string;
};

type WorksheetRequestBody = {
  subject: string;
  topic: string;
  grade: string;
  worksheetType?: string;
  difficulty?: string;
  numQuestions?: number;
  durationMins?: number;
  contentMode?: ContentMode;
};

function jsonOk(data: unknown, status = 200) {
  return NextResponse.json({ ok: true, data }, { status });
}

function jsonErr(error: string, status = 500) {
  return NextResponse.json({ ok: false, error }, { status });
}

function getBearerToken(req: NextRequest) {
  const auth = req.headers.get("authorization") ?? "";
  return auth.startsWith("Bearer ") ? auth.slice(7) : "";
}

function supabaseWithToken(token: string) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anon) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY");
  }

  return createClient(url, anon, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
}

function clampInt(n: unknown, min: number, max: number, fallback: number) {
  const x = Number(n);
  if (!Number.isFinite(x)) return fallback;
  return Math.max(min, Math.min(max, Math.trunc(x)));
}

function normalizeContentMode(value: unknown): ContentMode {
  if (value === "coloring" || value === "diagram" || value === "practical") return value;
  return "normal";
}

function normalizeInstructions(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((x) => String(x ?? "").trim())
    .filter(Boolean);
}

function normalizeVisualPrompts(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  const out: string[] = [];
  for (const item of raw) {
    if (typeof item === "string" && item.trim()) {
      out.push(item.trim());
      continue;
    }
    if (item && typeof item === "object") {
      const obj = item as { prompt?: unknown; label?: unknown };
      const prompt = String(obj.prompt ?? obj.label ?? "").trim();
      if (prompt) out.push(prompt);
    }
  }
  return out;
}

function getErrorMessage(error: unknown, fallback: string) {
  if (error && typeof error === "object" && "message" in error) {
    return String((error as { message?: unknown }).message ?? fallback);
  }
  return fallback;
}

function extractVisualPromptsFromWorksheet(worksheet: string): string[] {
  const text = worksheet || "";
  const regex = /\[(?:Coloring Picture|Diagram)\s*:\s*([^\]]+)\]/gi;
  const found = new Set<string>();
  let match: RegExpExecArray | null = regex.exec(text);
  while (match) {
    const label = String(match[1] ?? "").trim();
    if (label) found.add(label);
    match = regex.exec(text);
  }
  return [...found];
}

function dedupeKeepOrder(values: string[]) {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const v of values) {
    const key = v.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(v);
  }
  return out;
}

function hasBasicNumbering(text: string, count: number) {
  const t = text || "";
  return t.includes("1.") && (t.includes(`${count}.`) || t.includes(`${count})`));
}

function buildWorksheetPrompt(input: WorksheetRequestBody) {
  const count = clampInt(input.numQuestions, 5, 50, 10);
  const type = String(input.worksheetType ?? "Mixed").trim();
  const difficulty = String(input.difficulty ?? "Medium").trim();
  const duration = clampInt(input.durationMins, 10, 180, 30);
  const contentMode = normalizeContentMode(input.contentMode);

  const modeRules =
    contentMode === "coloring"
      ? `
Special requirements:
- This is a nursery/early-years coloring worksheet.
- Use very simple child-friendly language.
- Every question/task MUST include a placeholder in this exact style:
  [Coloring Picture: ...]
- Also include a "visualPrompts" array with 3 to 8 short outline prompts to generate black-and-white printable coloring images.
- Prompts must be simple (e.g., "Apple outline", "Lion outline", "Letter A tracing", "Family house outline").
`
      : contentMode === "diagram" || contentMode === "practical"
      ? `
Special requirements:
- This is a diagram/practical worksheet.
- Include clear label-ready tasks.
- Add placeholders in worksheet where visuals are needed, in this exact style:
  [Diagram: ...]
- Also include a "visualPrompts" array with 3 to 6 diagram prompts suitable for black-and-white labeled outline diagrams.
- Example prompts: "Human heart labeled outline", "Plant cell labeled outline", "Simple electric circuit labeled outline".
`
      : `
Special requirements:
- Keep the worksheet classroom-ready and printable.
- visualPrompts should be an empty array.
`;

  return `
Return STRICT JSON only. No markdown. No backticks. No extra text.

Audience: ${input.grade}
Subject: ${input.subject}
Topic: ${input.topic}
Content Mode: ${contentMode}

Worksheet Type: ${type}
Difficulty: ${difficulty}
Questions Count: ${count}
Duration: ${duration} minutes

${modeRules}

You MUST output JSON with exactly this shape:
{
  "title": "",
  "instructions": ["...","..."],
  "worksheet": "A clean printable worksheet text with numbered questions 1..${count}.",
  "answerKey": "Answer key text that corresponds to questions 1..${count}.",
  "visualPrompts": ["..."]
}

Hard requirements:
- worksheet MUST contain EXACTLY ${count} numbered questions (1..${count})
- The worksheet must be classroom-ready and Nigeria-relevant where possible
- The answerKey must cover ALL questions (1..${count})
- Keep formatting neat and printable (clear spacing, headings)
- Return JSON only
`.trim();
}

async function generateOutlineImage(
  client: OpenAI,
  params: {
    prompt: string;
    contentMode: ContentMode;
    subject: string;
    topic: string;
    grade: string;
  }
): Promise<WorksheetVisual | null> {
  const basePrompt =
    params.contentMode === "coloring"
      ? `
Create a black-and-white printable coloring outline image for children.
No shading, no color, no background scenery, no watermark, no text.
Use thick clean contour lines and lots of blank spaces for coloring.
`
      : `
Create a black-and-white printable educational labeled-diagram outline.
No shading, no color, no background scenery, no watermark, no text paragraphs.
Include clean line art suitable for students to label.
`;

  const finalPrompt = `
${basePrompt}
Subject: ${params.subject}
Topic: ${params.topic}
Grade: ${params.grade}
Image focus: ${params.prompt}
`.trim();

  try {
    const imageResp = await client.images.generate({
      model: "gpt-image-1",
      prompt: finalPrompt,
      size: "1024x1024",
      quality: "medium",
    });

    const b64 = imageResp?.data?.[0]?.b64_json;
    if (!b64 || typeof b64 !== "string") return null;

    return {
      label: params.prompt,
      imageDataUrl: `data:image/png;base64,${b64}`,
    };
  } catch {
    return null;
  }
}

async function generateWorksheetVisuals(
  client: OpenAI,
  params: {
    prompts: string[];
    contentMode: ContentMode;
    subject: string;
    topic: string;
    grade: string;
    maxCount: number;
  }
): Promise<WorksheetVisual[]> {
  const cleanPrompts = dedupeKeepOrder(
    params.prompts.map((x) => x.trim()).filter(Boolean)
  ).slice(0, params.maxCount);

  const visuals: WorksheetVisual[] = [];
  for (const prompt of cleanPrompts) {
    const one = await generateOutlineImage(client, {
      prompt,
      contentMode: params.contentMode,
      subject: params.subject,
      topic: params.topic,
      grade: params.grade,
    });
    if (one) visuals.push(one);
  }
  return visuals;
}

/**
 * GET
 * - /api/worksheets            => list meta
 * - /api/worksheets?id=<uuid>  => fetch full row + generated view model
 * - /api/worksheets?id=<uuid>&visuals=1 => also regenerate visual outlines from worksheet placeholders
 */
export async function GET(req: NextRequest) {
  try {
    const token = getBearerToken(req);
    if (!token) return jsonErr("Unauthorized (no token)", 401);

    const supabase = supabaseWithToken(token);

    const { data: authData, error: authErr } = await supabase.auth.getUser();
    const user = authData?.user;
    if (authErr || !user) return jsonErr("Unauthorized (invalid token)", 401);

    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");
    const withVisuals = searchParams.get("visuals") === "1";

    if (id) {
      const { data, error } = await supabase
        .from("worksheets")
        .select(
          "id, user_id, subject, topic, grade, worksheet_type, difficulty, num_questions, duration_mins, title, instructions, worksheet, answer_key, created_at"
        )
        .eq("id", id)
        .eq("user_id", user.id)
        .maybeSingle();

      if (error) return jsonErr(error.message, 500);
      if (!data) return jsonErr("Worksheet not found", 404);

      const worksheet = data?.worksheet ?? "";
      const placeholderPrompts = extractVisualPromptsFromWorksheet(worksheet);
      const likelyMode: ContentMode = worksheet.includes("[Coloring Picture:")
        ? "coloring"
        : worksheet.includes("[Diagram:")
        ? "diagram"
        : "normal";

      let visuals: WorksheetVisual[] = [];
      if (
        withVisuals &&
        likelyMode !== "normal" &&
        placeholderPrompts.length > 0 &&
        process.env.OPENAI_API_KEY
      ) {
        const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
        visuals = await generateWorksheetVisuals(client, {
          prompts: placeholderPrompts,
          contentMode: likelyMode,
          subject: data.subject,
          topic: data.topic,
          grade: data.grade,
          maxCount: likelyMode === "coloring" ? 8 : 6,
        });
      }

      const generated = {
        title: data?.title ?? `${data?.subject ?? ""}: ${data?.topic ?? ""}`.trim(),
        instructions: Array.isArray(data?.instructions) ? data.instructions : [],
        worksheet,
        answerKey: data?.answer_key ?? "",
        visuals,
      };

      return jsonOk({ saved: data, generated }, 200);
    }

    const { data, error } = await supabase
      .from("worksheets")
      .select(
        "id, subject, topic, grade, worksheet_type, difficulty, num_questions, duration_mins, created_at"
      )
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(100);

    if (error) return jsonErr(error.message, 500);
    return jsonOk(data ?? [], 200);
  } catch (e: unknown) {
    return jsonErr(getErrorMessage(e, "Failed"), 500);
  }
}

/**
 * POST /api/worksheets
 * Generates + autosaves to DB
 */
export async function POST(req: NextRequest) {
  try {
    const token = getBearerToken(req);
    if (!token) return jsonErr("Unauthorized (no token)", 401);

    const supabase = supabaseWithToken(token);

    const { data: authData, error: authErr } = await supabase.auth.getUser();
    const user = authData?.user;
    if (authErr || !user) return jsonErr("Unauthorized (invalid token)", 401);

    let body: WorksheetRequestBody;
    try {
      body = (await req.json()) as WorksheetRequestBody;
    } catch {
      return jsonErr("Invalid JSON body", 400);
    }

    const subject = String(body?.subject ?? "").trim();
    const topic = String(body?.topic ?? "").trim();
    const grade = String(body?.grade ?? "").trim();
    if (!subject || !topic || !grade) {
      return jsonErr("Missing required fields: subject, topic, grade", 400);
    }

    if (!process.env.OPENAI_API_KEY) return jsonErr("OPENAI_API_KEY missing", 500);

    const contentMode = normalizeContentMode(body.contentMode);
    const count = clampInt(body.numQuestions, 5, 50, 10);
    const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

    const resp = await client.responses.create({
      model: "gpt-4.1-mini",
      input: [
        { role: "system", content: "Return STRICT valid JSON only. No markdown. No extra text." },
        { role: "user", content: buildWorksheetPrompt({ ...body, contentMode }) },
      ],
      temperature: 0.2,
      max_output_tokens: 3500,
      text: { format: { type: "json_object" } },
    });

    const raw = resp.output_text ?? "";
    let parsed: Record<string, unknown>;
    try {
      parsed = JSON.parse(raw);
    } catch {
      return jsonErr("Model returned invalid JSON", 502);
    }

    const title = (parsed?.title && String(parsed.title).trim()) || `${subject}: ${topic}`.trim();
    const instructions = normalizeInstructions(parsed?.instructions);
    const worksheet = String(parsed?.worksheet ?? "").trim();
    const answerKey = String(parsed?.answerKey ?? parsed?.answer_key ?? "").trim();

    if (!worksheet) return jsonErr("Generation failed: worksheet is empty", 502);
    if (!answerKey) return jsonErr("Generation failed: answerKey is empty", 502);
    if (!hasBasicNumbering(worksheet, count)) {
      return jsonErr("Generation failed: worksheet numbering/format is not correct. Please try again.", 502);
    }

    let promptCandidates = dedupeKeepOrder([
      ...normalizeVisualPrompts(parsed?.visualPrompts),
      ...extractVisualPromptsFromWorksheet(worksheet),
    ]);

    if (contentMode !== "normal" && promptCandidates.length === 0) {
      promptCandidates =
        contentMode === "coloring"
          ? [
              `${topic} object outline`,
              "Apple outline",
              "House outline",
              "Flower outline",
            ]
          : [
              `${topic} labeled outline`,
              `${subject} practical diagram outline`,
              "Scientific labeled diagram outline",
            ];
    }

    const shouldGenerateVisuals = contentMode !== "normal" && promptCandidates.length > 0;
    const visuals = shouldGenerateVisuals
      ? await generateWorksheetVisuals(client, {
          prompts: promptCandidates,
          contentMode,
          subject,
          topic,
          grade,
          maxCount: contentMode === "coloring" ? 8 : 6,
        })
      : [];

    const { data: saved, error: saveErr } = await supabase
      .from("worksheets")
      .insert({
        user_id: user.id,
        subject,
        topic,
        grade,
        worksheet_type: body.worksheetType ?? null,
        difficulty: body.difficulty ?? null,
        num_questions: count,
        duration_mins: clampInt(body.durationMins, 10, 180, 30),
        title,
        instructions,
        worksheet,
        answer_key: answerKey,
      })
      .select(
        "id, subject, topic, grade, worksheet_type, difficulty, num_questions, duration_mins, created_at"
      )
      .single();

    if (saveErr) return jsonErr(saveErr.message, 500);

    return jsonOk(
      {
        saved,
        generated: { title, instructions, worksheet, answerKey, visuals, contentMode },
      },
      200
    );
  } catch (e: unknown) {
    return NextResponse.json(
      {
        ok: false,
        error: "Worksheet generation failed",
        message: getErrorMessage(e, "Worksheet generation failed"),
      },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/worksheets?id=<uuid>
 */
export async function DELETE(req: NextRequest) {
  try {
    const token = getBearerToken(req);
    if (!token) return jsonErr("Unauthorized (no token)", 401);

    const supabase = supabaseWithToken(token);

    const { data: authData, error: authErr } = await supabase.auth.getUser();
    const user = authData?.user;
    if (authErr || !user) return jsonErr("Unauthorized (invalid token)", 401);

    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");
    if (!id) return jsonErr("Missing id", 400);

    const { data, error } = await supabase
      .from("worksheets")
      .delete()
      .eq("id", id)
      .eq("user_id", user.id)
      .select("id")
      .maybeSingle();

    if (error) return jsonErr(error.message, 500);
    if (!data) return jsonErr("Worksheet not found", 404);

    return jsonOk({ deleted: true }, 200);
  } catch (e: unknown) {
    return jsonErr(getErrorMessage(e, "Delete failed"), 500);
  }
}
