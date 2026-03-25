import OpenAI from "openai";
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

import { buildExamGenerationPrompt } from "@/lib/exams/prompt";
import {
  buildExamResultFromModel,
  mapInputToDbFields,
  parseExamBuilderInput,
} from "@/lib/exams/normalize";
import { EXAM_MODEL } from "@/lib/exams/constants";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

type ExamPatchBody = {
  id: string;
  examTitle?: string;
  schoolName?: string | null;
  instructions?: string[];
  resultJson?: unknown;
};

function jsonOk(data: unknown, status = 200) {
  return NextResponse.json({ ok: true, data }, { status });
}

function jsonErr(error: string, status = 500) {
  return NextResponse.json({ ok: false, error }, { status });
}

function getErrorMessage(err: unknown, fallback: string) {
  if (err && typeof err === "object" && "message" in err) {
    return String((err as { message?: unknown }).message ?? fallback);
  }
  return fallback;
}

function normalizeInstructions(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.map((x) => String(x ?? "").trim()).filter(Boolean).slice(0, 10);
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
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
}

async function authenticate(req: NextRequest) {
  const token = getBearerToken(req);
  if (!token) {
    return { ok: false as const, error: "Unauthorized (no token)", status: 401 };
  }

  const supabase = supabaseWithToken(token);
  const { data: authData, error: authErr } = await supabase.auth.getUser();
  const user = authData?.user;

  if (authErr || !user) {
    return { ok: false as const, error: "Unauthorized (invalid token)", status: 401 };
  }

  return { ok: true as const, supabase, user };
}

export async function GET(req: NextRequest) {
  try {
    const auth = await authenticate(req);
    if (!auth.ok) return jsonErr(auth.error, auth.status);

    const { supabase, user } = auth;
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");

    if (id) {
      const { data, error } = await supabase
        .from("exams")
        .select(
          `
          id,
          user_id,
          subject,
          topic_or_coverage,
          class_or_grade,
          school_level,
          curriculum,
          exam_alignment,
          exam_type,
          duration_mins,
          total_marks,
          objective_question_count,
          theory_question_count,
          difficulty_level,
          instructions,
          special_notes,
          school_name,
          exam_title_override,
          exam_title,
          result_json,
          metadata,
          status,
          created_at,
          updated_at
        `
        )
        .eq("id", id)
        .eq("user_id", user.id)
        .maybeSingle();

      if (error) return jsonErr(error.message, 500);
      if (!data) return jsonErr("Exam not found", 404);
      return jsonOk(data, 200);
    }

    const { data, error } = await supabase
      .from("exams")
      .select(
        `
        id,
        exam_title,
        subject,
        class_or_grade,
        exam_type,
        exam_alignment,
        objective_question_count,
        theory_question_count,
        duration_mins,
        total_marks,
        created_at,
        updated_at
      `
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

export async function POST(req: NextRequest) {
  try {
    const auth = await authenticate(req);
    if (!auth.ok) return jsonErr(auth.error, auth.status);
    const { supabase, user } = auth;

    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return jsonErr("Invalid JSON body", 400);
    }

    const parsedInput = parseExamBuilderInput(body);
    if (!parsedInput.ok) return jsonErr(parsedInput.error, 400);
    const input = parsedInput.input;

    if (!process.env.OPENAI_API_KEY) {
      return jsonErr("OPENAI_API_KEY missing", 500);
    }

    const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

    const resp = await client.responses.create({
      model: EXAM_MODEL,
      input: [
        {
          role: "system",
          content:
            "Return STRICT valid JSON only. No markdown. No backticks. No extra commentary.",
        },
        {
          role: "user",
          content: buildExamGenerationPrompt(input),
        },
      ],
      temperature: 0.2,
      max_output_tokens: 4500,
      text: { format: { type: "json_object" } },
    });

    const raw = resp.output_text ?? "";
    let modelParsed: unknown = {};
    try {
      modelParsed = JSON.parse(raw);
    } catch {
      return jsonErr("Model returned invalid JSON", 502);
    }

    const built = buildExamResultFromModel(input, modelParsed);
    if (!built.objectiveCountOk || !built.theoryCountOk) {
      return jsonErr(
        "Generation failed: model did not return the required objective/theory question counts. Please try again.",
        502
      );
    }

    // Charge generation credit only after we have a valid exam payload.
    const { data: creditData, error: creditErr } = await supabase.rpc("consume_generation_credit");
    if (creditErr) {
      return jsonErr(`Credit check failed: ${creditErr.message}`, 500);
    }
    if (!creditData?.ok) {
      const msg = String(creditData?.error ?? "No credits");
      return jsonErr(msg, msg.toLowerCase().includes("not authenticated") ? 401 : 402);
    }

    const dbFields = mapInputToDbFields(input);

    const { data: saved, error: saveErr } = await supabase
      .from("exams")
      .insert({
        user_id: user.id,
        ...dbFields,
        exam_title: built.result.examTitle,
        result_json: built.result,
        metadata: built.result.metadata,
        status: "published",
      })
      .select(
        `
        id,
        user_id,
        subject,
        topic_or_coverage,
        class_or_grade,
        school_level,
        curriculum,
        exam_alignment,
        exam_type,
        duration_mins,
        total_marks,
        objective_question_count,
        theory_question_count,
        difficulty_level,
        instructions,
        special_notes,
        school_name,
        exam_title_override,
        exam_title,
        result_json,
        metadata,
        status,
        created_at,
        updated_at
      `
      )
      .single();

    if (saveErr) {
      // Optional RPC in some environments; ignore failures.
      await supabase.rpc("refund_generation_credit").match(() => null);
      return jsonErr(saveErr.message, 500);
    }
    return jsonOk(saved, 201);
  } catch (e: unknown) {
    return jsonErr(getErrorMessage(e, "Exam generation failed"), 500);
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const auth = await authenticate(req);
    if (!auth.ok) return jsonErr(auth.error, auth.status);
    const { supabase, user } = auth;

    let body: ExamPatchBody;
    try {
      body = (await req.json()) as ExamPatchBody;
    } catch {
      return jsonErr("Invalid JSON body", 400);
    }

    if (!body?.id) return jsonErr("Missing exam id", 400);

    const updates: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };

    if ("examTitle" in body) {
      const title = String(body.examTitle ?? "").trim();
      if (!title) return jsonErr("examTitle cannot be empty", 400);
      updates.exam_title = title;
    }
    if ("schoolName" in body) updates.school_name = body.schoolName?.trim() || null;
    if ("instructions" in body) updates.instructions = normalizeInstructions(body.instructions);
    if ("resultJson" in body) updates.result_json = body.resultJson;

    const { data, error } = await supabase
      .from("exams")
      .update(updates)
      .eq("id", body.id)
      .eq("user_id", user.id)
      .select(
        `
        id,
        user_id,
        subject,
        topic_or_coverage,
        class_or_grade,
        school_level,
        curriculum,
        exam_alignment,
        exam_type,
        duration_mins,
        total_marks,
        objective_question_count,
        theory_question_count,
        difficulty_level,
        instructions,
        special_notes,
        school_name,
        exam_title_override,
        exam_title,
        result_json,
        metadata,
        status,
        created_at,
        updated_at
      `
      )
      .maybeSingle();

    if (error) return jsonErr(error.message, 500);
    if (!data) return jsonErr("Exam not found", 404);
    return jsonOk(data, 200);
  } catch (e: unknown) {
    return jsonErr(getErrorMessage(e, "Update failed"), 500);
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const auth = await authenticate(req);
    if (!auth.ok) return jsonErr(auth.error, auth.status);
    const { supabase, user } = auth;

    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");
    if (!id) return jsonErr("Missing id", 400);

    const { data, error } = await supabase
      .from("exams")
      .delete()
      .eq("id", id)
      .eq("user_id", user.id)
      .select("id")
      .maybeSingle();

    if (error) return jsonErr(error.message, 500);
    if (!data) return jsonErr("Exam not found", 404);
    return jsonOk({ deleted: true }, 200);
  } catch (e: unknown) {
    return jsonErr(getErrorMessage(e, "Delete failed"), 500);
  }
}
