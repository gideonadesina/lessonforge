import { NextRequest, NextResponse } from "next/server";
import {
  buildStage3Prompt,
  fetchOwnedLesson,
  getAuthedContext,
  mergeIncomingMeta,
  normalizeStage3,
  openAiClient,
  parseOpenAiJson,
  readJsonBody,
  updateLessonResult,
  validateRequiredGenerationMeta,
  validateStage3,
} from "@/lib/generation/staged-lesson";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  try {
    const auth = await getAuthedContext(req);
    if (!auth.ok) return auth.response;

    const body = await readJsonBody(req);
    if (body instanceof NextResponse) return body;

    const lessonId = typeof body.lessonId === "string" ? body.lessonId : "";
    if (!lessonId) {
      return NextResponse.json({ ok: false, error: "missing_lesson_id", message: "lessonId is required." }, { status: 400 });
    }

    const { data: lesson, error: lessonErr } = await fetchOwnedLesson(auth.supabase, lessonId, auth.userId);
    if (lessonErr || !lesson) {
      return NextResponse.json(
        { ok: false, error: "lesson_not_found", message: lessonErr?.message ?? "Lesson not found." },
        { status: 404 }
      );
    }

    const existing = ((lesson as any).result_json ?? {}) as Record<string, any>;
    const meta = mergeIncomingMeta(body, existing);
    const metaError = validateRequiredGenerationMeta(meta);
    if (metaError) {
      return NextResponse.json({ ok: false, error: "invalid_generation_metadata", message: metaError }, { status: 400 });
    }

    const client = openAiClient();
    if (!client) {
      return NextResponse.json({ ok: false, error: "OPENAI_API_KEY missing" }, { status: 500 });
    }

    const resp = await client.responses.create({
      model: "gpt-4.1-mini",
      input: [
        { role: "system", content: "Return STRICT valid JSON only. No markdown. No backticks." },
        { role: "user", content: buildStage3Prompt(meta, existing) },
      ],
      temperature: 0.2,
      max_output_tokens: 4500,
      text: { format: { type: "json_object" } },
    });

    const parsed = await parseOpenAiJson(resp);
    if (!parsed.ok) return parsed.response;

    const stage3 = normalizeStage3(parsed.data, meta);
    const validationError = validateStage3(stage3, meta);
    if (validationError) {
      return NextResponse.json({ ok: false, error: "openai_json_incomplete", message: validationError }, { status: 500 });
    }

    const nextData = {
      ...existing,
      slides: stage3.slides,
      meta: {
        ...(existing.meta ?? {}),
        generationMeta: meta,
        stage: 3,
      },
    };

    const { error: updateErr } = await updateLessonResult(auth.supabase, lessonId, auth.userId, nextData);
    if (updateErr) {
      console.error("[generate:stage3] Failed to update lesson:", updateErr.message);
      return NextResponse.json(
        { ok: false, error: "lesson_update_failed", message: updateErr.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ ok: true, lessonId, generationMeta: meta, data: nextData }, { status: 200 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Stage 3 generation failed.";
    console.error("[generate:stage3] Error:", error);
    return NextResponse.json({ ok: false, error: "stage3_failed", message }, { status: 500 });
  }
}

