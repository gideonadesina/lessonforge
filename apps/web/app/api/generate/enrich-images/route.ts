import { NextRequest, NextResponse } from "next/server";
import {
  enrichSlidesWithPexelsImages,
  fetchOwnedLesson,
  getAuthedContext,
  readJsonBody,
  updateLessonResult,
} from "@/lib/generation/staged-lesson";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;
export const maxDuration = 15;

type JsonRecord = Record<string, unknown>;
type LessonWithResult = {
  topic?: string | null;
  subject?: string | null;
  result_json?: JsonRecord | null;
};

function readMetaString(data: JsonRecord, key: "topic" | "subject") {
  const meta = data.meta;
  if (!meta || typeof meta !== "object") return "";
  const value = (meta as JsonRecord)[key];
  return typeof value === "string" ? value : "";
}

function readMetaStage(data: JsonRecord) {
  const meta = data.meta;
  if (!meta || typeof meta !== "object") return 3;
  const value = (meta as JsonRecord).stage;
  return Number(value ?? 3);
}

export async function POST(req: NextRequest) {
  try {
    console.log("[enrich-images] called");
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

    const lessonRecord = lesson as LessonWithResult;
    const existing = (lessonRecord.result_json ?? {}) as JsonRecord;
    const slides = Array.isArray(existing.slides) ? (existing.slides as JsonRecord[]) : [];
    const pexelsKey = process.env.PEXELS_API_KEY ?? "";
    const topic = readMetaString(existing, "topic") || lessonRecord.topic || "";
    const subject = readMetaString(existing, "subject") || lessonRecord.subject || "";

    console.log("[enrich-images] has PEXELS_API_KEY:", Boolean(process.env.PEXELS_API_KEY));
    console.log("[enrich-images] slides count:", slides?.length);
    console.log("[enrich-images] topic:", topic);
    console.log("[enrich-images] subject:", subject);

    if (!pexelsKey) {
      return NextResponse.json(
        {
          ok: true,
          lessonId,
          data: existing,
          warning: {
            code: "pexels_api_key_missing",
            message: "PEXELS_API_KEY is not configured. Slides were generated without Pexels images.",
          },
        },
        { status: 200 }
      );
    }

    if (slides.length === 0) {
      return NextResponse.json({ ok: true, lessonId, data: existing }, { status: 200 });
    }

    const enrichedSlides = await enrichSlidesWithPexelsImages(slides, pexelsKey, {
      timeoutMs: 5000,
      overallTimeoutMs: 10000,
      topic,
      subject,
    });
    console.log("[enrich-images] images found:", enrichedSlides.filter((s) => s.image_url).length);

    const nextData = {
      ...existing,
      slides: enrichedSlides,
      meta: {
        ...(existing.meta ?? {}),
        stage: Math.max(3, readMetaStage(existing)),
        imagesEnriched: enrichedSlides.some((slide) => Boolean(slide?.image_url)),
      },
    };

    const { error: updateErr } = await updateLessonResult(auth.supabase, lessonId, auth.userId, nextData);
    if (updateErr) {
      console.error("[generate:enrich-images] Failed to update lesson:", updateErr.message);
      return NextResponse.json(
        { ok: false, error: "lesson_update_failed", message: updateErr.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ ok: true, lessonId, data: nextData }, { status: 200 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Image enrichment failed.";
    console.error("[generate:enrich-images] Error:", error);
    return NextResponse.json({ ok: false, error: "image_enrichment_failed", message }, { status: 500 });
  }
}
