import OpenAI from "openai";
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

import { buildExamGenerationPrompt } from "@/lib/exams/prompt";
import {
  buildExamResultFromModel,
  mapInputToDbFields,
  normalizeEditedExamResult,
  parseExamBuilderInput,
} from "@/lib/exams/normalize";
import { EXAM_MODEL } from "@/lib/exams/constants";
import type { ExamRecord } from "@/lib/exams/types";
import { consumeGenerationCredits, getGenerationCreditAvailability } from "@/lib/credits/server";

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

type ExamReuseBody = {
  sourceExamId: string;
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

function getDbSelectFields() {
  return `
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
  `;
}

function getListSelectFields() {
  return `
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
  `;
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
    searchParams.get("action");

    if (id) {
      const { data, error } = await supabase
        .from("exams")
        .select(getDbSelectFields())
        .eq("id", id)
        .eq("user_id", user.id)
        .maybeSingle();

      if (error) return jsonErr(error.message, 500);
      if (!data) return jsonErr("Exam not found", 404);
      return jsonOk(data, 200);
    }

    const { data, error } = await supabase
      .from("exams")
      .select(getListSelectFields())
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

    const payload = (body && typeof body === "object" ? body : {}) as Record<string, unknown>;
    const action = String(payload.action ?? "").trim().toLowerCase();

    if (action === "reuse") {
      const reuseBody = payload as unknown as ExamReuseBody;
      const sourceExamId = String(reuseBody.sourceExamId ?? "").trim();
      if (!sourceExamId) return jsonErr("Missing sourceExamId", 400);

      const { data: source, error: sourceErr } = await supabase
        .from("exams")
        .select(getDbSelectFields())
        .eq("id", sourceExamId)
        .eq("user_id", user.id)
        .maybeSingle();

      if (sourceErr) return jsonErr(sourceErr.message, 500);
      if (!source) return jsonErr("Source exam not found", 404);

      const sourceExam = source as unknown as ExamRecord;
      const sourceResult = normalizeEditedExamResult(sourceExam.result_json, sourceExam.result_json);

      const cloneTitle = `${sourceExam.exam_title} (Copy)`;
      sourceResult.examTitle = cloneTitle;
      sourceResult.printableHeader.examTitle = cloneTitle;
      sourceResult.metadata.lifecycle.sourceExamId = sourceExam.id;
      sourceResult.metadata.lifecycle.reusable = true;
      sourceResult.metadata.lifecycle.editable = true;
      sourceResult.metadata.generation.generatedAt = new Date().toISOString();

      const cloneMetadata = {
        ...(sourceExam.metadata ?? {}),
        lifecycle: {
          status: "published",
          editable: true,
          reusable: true,
          sourceExamId: sourceExam.id,
        },
      };

      const { data: cloned, error: cloneErr } = await supabase
        .from("exams")
        .insert({
          user_id: user.id,
          subject: sourceExam.subject,
          topic_or_coverage: sourceExam.topic_or_coverage,
          class_or_grade: sourceExam.class_or_grade,
          school_level: sourceExam.school_level,
          curriculum: sourceExam.curriculum,
          exam_alignment: sourceExam.exam_alignment,
          exam_type: sourceExam.exam_type,
          duration_mins: sourceExam.duration_mins,
          total_marks: sourceExam.total_marks,
          objective_question_count: sourceExam.objective_question_count,
          theory_question_count: sourceExam.theory_question_count,
          difficulty_level: sourceExam.difficulty_level,
          instructions: sourceExam.instructions,
          special_notes: sourceExam.special_notes,
          school_name: sourceExam.school_name,
          exam_title_override: sourceExam.exam_title_override,
          exam_title: cloneTitle,
          result_json: sourceResult,
          metadata: cloneMetadata,
          status: "published",
        })
        .select(getDbSelectFields())
        .single();

      if (cloneErr) return jsonErr(cloneErr.message, 500);
      return jsonOk(cloned, 201);
    }

    const parsedInput = parseExamBuilderInput(body);
    if (!parsedInput.ok) return jsonErr(parsedInput.error, 400);
    const input = parsedInput.input;

    const creditAvailability = await getGenerationCreditAvailability(supabase, user.id);
    if (!creditAvailability.ok) {
      return NextResponse.json(
        {
          ok: false,
          error: "credit_check_failed",
          message: creditAvailability.error,
          upgrade_url: null,
        },
        { status: 500 }
      );
    }
    if (creditAvailability.creditsRemaining <= 0) {
      if (creditAvailability.source === "school") {
        return NextResponse.json(
          {
            ok: false,
            error: "school_out_of_credits",
            message:
              "Your school has used all its credits. Your principal has been notified and will add more credits soon.",
            upgrade_url: null,
          },
          { status: 402 }
        );
      }
      return NextResponse.json(
        {
          ok: false,
          error: "out_of_credits",
          message:
            "You have used all your credits. Purchase more to continue generating lessons.",
          upgrade_url: "/pricing",
        },
        { status: 402 }
      );
    }

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
      .select(getDbSelectFields())
      .single();

    if (saveErr) {
      return jsonErr(saveErr.message, 500);
    }

    const deductionResult = await consumeGenerationCredits(supabase, user.id, 1);
    if (!deductionResult.ok) {
      console.error("[exams] Credit deduction failed after successful generation:", {
        userId: user.id,
        errorCode: deductionResult.errorCode,
        error: deductionResult.error,
      });
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
    if ("resultJson" in body) {
      const { data: existingExam, error: existingErr } = await supabase
        .from("exams")
        .select("result_json")
        .eq("id", body.id)
        .eq("user_id", user.id)
        .maybeSingle();

      if (existingErr) return jsonErr(existingErr.message, 500);
      if (!existingExam?.result_json || typeof existingExam.result_json !== "object") {
        return jsonErr("Existing exam payload not found", 404);
      }

      const mergedRaw = body.resultJson as Record<string, unknown>;
      if ("examTitle" in body) mergedRaw.examTitle = String(body.examTitle ?? "").trim();
      if ("schoolName" in body) mergedRaw.schoolName = body.schoolName ?? null;
      if ("instructions" in body) mergedRaw.instructions = normalizeInstructions(body.instructions);

      const normalized = normalizeEditedExamResult(mergedRaw, existingExam.result_json);
      updates.result_json = normalized;
      updates.metadata = normalized.metadata;
      updates.exam_title = normalized.examTitle;
      updates.total_marks = normalized.totalMarks;
      updates.objective_question_count = normalized.objectiveSection.questions.length;
      updates.theory_question_count = normalized.theorySection.questions.length;
    }

    const { data, error } = await supabase
      .from("exams")
      .update(updates)
      .eq("id", body.id)
      .eq("user_id", user.id)
      .select(getDbSelectFields())
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
