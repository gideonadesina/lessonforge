import OpenAI from "openai";
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

type WorksheetRequestBody = {
  subject: string;
  topic: string;
  grade: string;
  worksheetType?: string;
  difficulty?: string;
  numQuestions?: number;
  durationMins?: number;
};

function jsonOk(data: any, status = 200) {
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

function clampInt(n: any, min: number, max: number, fallback: number) {
  const x = Number(n);
  if (!Number.isFinite(x)) return fallback;
  return Math.max(min, Math.min(max, Math.trunc(x)));
}

/** Prompt builder: returns JSON that matches YOUR DB columns */
function buildWorksheetPrompt(input: WorksheetRequestBody) {
  const count = clampInt(input.numQuestions, 5, 50, 10);
  const type = input.worksheetType ?? "Mixed";
  const difficulty = input.difficulty ?? "Medium";
  const duration = clampInt(input.durationMins, 10, 180, 30);

  return `
Return STRICT JSON only. No markdown. No backticks. No extra text.

Audience: ${input.grade}
Subject: ${input.subject}
Topic: ${input.topic}

Worksheet Type: ${type}
Difficulty: ${difficulty}
Questions Count: ${count}
Duration: ${duration} minutes

You MUST output JSON with exactly this shape:
{
  "title": "",
  "instructions": ["...","..."],
  "worksheet": "A clean printable worksheet text with numbered questions 1..${count}.",
  "answerKey": "Answer key text that corresponds to questions 1..${count}."
}

Hard requirements:
- worksheet MUST contain EXACTLY ${count} numbered questions (1..${count})
- The worksheet must be classroom-ready and Nigeria-relevant where possible
- The answerKey must cover ALL questions (1..${count})
- Keep formatting neat and printable (clear spacing, headings)

Return JSON only.
`.trim();
}

function hasBasicNumbering(text: string, count: number) {
  const t = text || "";
  return t.includes("1.") && (t.includes(`${count}.`) || t.includes(`${count})`));
}

/**
 * GET
 * - /api/worksheets            => list meta
 * - /api/worksheets?id=<uuid>  => fetch full row + generated view model
 */
export async function GET(req: NextRequest) {
  try {
    const token = getBearerToken(req);
    if (!token) return jsonErr("Unauthorized (no token)", 401);

    const supabase = supabaseWithToken(token);

    const { data: authData, error: authErr } = await supabase.auth.getUser();
    if (authErr || !authData?.user) return jsonErr("Unauthorized (invalid token)", 401);

    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");

    // Full fetch (for modal open)
    if (id) {
      const { data, error } = await supabase
        .from("worksheets")
        .select(
          "id, subject, topic, grade, worksheet_type, difficulty, num_questions, duration_mins, title, instructions, worksheet, answer_key, created_at"
        )
        .eq("id", id)
        .single();

      if (error) return jsonErr(error.message, 500);

      const generated = {
        title: data?.title ?? `${data?.subject ?? ""}: ${data?.topic ?? ""}`.trim(),
        instructions: Array.isArray(data?.instructions) ? data.instructions : [],
        worksheet: data?.worksheet ?? "",
        answerKey: data?.answer_key ?? "",
      };

      return jsonOk({ saved: data, generated }, 200);
    }

    // List meta only
    const { data, error } = await supabase
      .from("worksheets")
      .select("id, subject, topic, grade, worksheet_type, difficulty, num_questions, duration_mins, created_at")
      .order("created_at", { ascending: false })
      .limit(100);

    if (error) return jsonErr(error.message, 500);
    return jsonOk(data ?? [], 200);
  } catch (e: any) {
    return jsonErr(e?.message ?? "Failed", 500);
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

    if (!body?.subject || !body?.topic || !body?.grade) {
      return jsonErr("Missing required fields: subject, topic, grade", 400);
    }

    if (!process.env.OPENAI_API_KEY) return jsonErr("OPENAI_API_KEY missing", 500);

    const count = clampInt(body.numQuestions, 5, 50, 10);
    const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

    const resp = await client.responses.create({
      model: "gpt-4.1-mini",
      input: [
        { role: "system", content: "Return STRICT valid JSON only. No markdown. No extra text." },
        { role: "user", content: buildWorksheetPrompt(body) },
      ],
      temperature: 0.2,
      max_output_tokens: 3500,
      text: { format: { type: "json_object" } },
    });

    const raw = resp.output_text ?? "";
    let parsed: any;
    try {
      parsed = JSON.parse(raw);
    } catch {
      return jsonErr("Model returned invalid JSON", 502);
    }

    const title = (parsed?.title && String(parsed.title)) || `${body.subject}: ${body.topic}`.trim();

    const instructions = Array.isArray(parsed?.instructions)
      ? parsed.instructions.map((x: any) => String(x))
      : [];

    const worksheet = String(parsed?.worksheet ?? "").trim();
    const answerKey = String(parsed?.answerKey ?? parsed?.answer_key ?? "").trim();

    // Guards: prevent empty/garbage inserts
    if (!worksheet) return jsonErr("Generation failed: worksheet is empty", 502);
    if (!answerKey) return jsonErr("Generation failed: answerKey is empty", 502);
    if (!hasBasicNumbering(worksheet, count)) {
      return jsonErr("Generation failed: worksheet numbering/format is not correct. Please try again.", 502);
    }

    const { data: saved, error: saveErr } = await supabase
      .from("worksheets")
      .insert({
        user_id: user.id,
        subject: body.subject,
        topic: body.topic,
        grade: body.grade,
        worksheet_type: body.worksheetType ?? null,
        difficulty: body.difficulty ?? null,
        num_questions: count,
        duration_mins: clampInt(body.durationMins, 10, 180, 30),
        title,
        instructions: instructions ?? [], // ALWAYS array
        worksheet,
        answer_key: answerKey,
      })
      .select("id, subject, topic, grade, worksheet_type, difficulty, num_questions, duration_mins, created_at")
      .single();

    if (saveErr) return jsonErr(saveErr.message, 500);

    return jsonOk(
      {
        saved,
        generated: { title, instructions, worksheet, answerKey },
      },
      200
    );
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: "Worksheet generation failed", message: e?.message ?? String(e) },
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
    if (authErr || !authData?.user) return jsonErr("Unauthorized (invalid token)", 401);

    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");
    if (!id) return jsonErr("Missing id", 400);

    const { error } = await supabase.from("worksheets").delete().eq("id", id);
    if (error) return jsonErr(error.message, 500);

    return jsonOk({ deleted: true }, 200);
  } catch (e: any) {
    return jsonErr(e?.message ?? "Delete failed", 500);
  }
}
