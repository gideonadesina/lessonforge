import { NextRequest, NextResponse } from "next/server";
import {
  buildStage1Prompt,
  checkCreditsOrResponse,
  deductStage1CreditsOrCleanup,
  getAuthedContext,
  mergeIncomingMeta,
  normalizeStage1,
  openAiClient,
  parseOpenAiJson,
  readJsonBody,
  validateRequiredGenerationMeta,
  validateStage1,
} from "@/lib/generation/staged-lesson";
import { ROLE_COOKIE_KEY } from "@/lib/auth/roles";

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

    const meta = mergeIncomingMeta(body);
    const metaError = validateRequiredGenerationMeta(meta);
    if (metaError) {
      return NextResponse.json({ ok: false, error: "invalid_generation_metadata", message: metaError }, { status: 400 });
    }

    const activeRole = req.cookies.get(ROLE_COOKIE_KEY)?.value ?? null;
    const creditResponse = await checkCreditsOrResponse(auth.supabase, auth.userId, meta, activeRole);
    if (creditResponse) return creditResponse;

    const client = openAiClient();
    if (!client) {
      return NextResponse.json({ ok: false, error: "OPENAI_API_KEY missing" }, { status: 500 });
    }

    const resp = await client.responses.create({
      model: "gpt-4.1-mini",
      input: [
        { role: "system", content: "Return STRICT valid JSON only. No markdown. No backticks." },
        { role: "user", content: buildStage1Prompt(meta) },
      ],
      temperature: 0.2,
      max_output_tokens: 6500,
      text: { format: { type: "json_object" } },
    });

    const parsed = await parseOpenAiJson(resp);
    if (!parsed.ok) return parsed.response;

    const data = normalizeStage1(parsed.data, meta);
    const validationError = validateStage1(data);
    if (validationError) {
      return NextResponse.json(
        {
          ok: false,
          error: "openai_json_incomplete",
          message: validationError,
        },
        { status: 500 }
      );
    }

    const { data: savedLesson, error: saveErr } = await auth.supabase
      .from("lessons")
      .insert({
        user_id: auth.userId,
        subject: meta.subject,
        topic: meta.topic,
        grade: meta.grade,
        curriculum: meta.curriculum,
        result_json: data,
        type: "lesson",
      })
      .select("id")
      .maybeSingle();

    if (saveErr || !savedLesson) {
      console.error("[generate:stage1] Failed to save lesson:", saveErr?.message);
      return NextResponse.json(
        {
          ok: false,
          error: "lesson_save_failed",
          message: saveErr?.message ?? "Lesson save returned no row.",
        },
        { status: 500 }
      );
    }

    const lessonId = String((savedLesson as { id: string }).id);
    const deductionResponse = await deductStage1CreditsOrCleanup(
      auth.supabase,
      lessonId,
      auth.userId,
      meta.usePersonalCredits === true,
      activeRole
    );
    if (deductionResponse) return deductionResponse;

    return NextResponse.json({ ok: true, lessonId, generationMeta: meta, data, saved: true }, { status: 200 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Stage 1 generation failed.";
    console.error("[generate:stage1] Error:", error);
    return NextResponse.json({ ok: false, error: "stage1_failed", message }, { status: 500 });
  }
}
