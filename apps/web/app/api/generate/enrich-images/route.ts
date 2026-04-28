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
    const slides = Array.isArray(existing.slides) ? existing.slides : [];
    const pexelsKey = process.env.PEXELS_API_KEY ?? "";

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
      timeoutMs: 2500,
      overallTimeoutMs: 5000,
      topic: typeof existing.meta?.topic === "string" ? existing.meta.topic : lesson.topic,
      subject: typeof existing.meta?.subject === "string" ? existing.meta.subject : lesson.subject,
    });

    const nextData = {
      ...existing,
      slides: enrichedSlides,
      meta: {
        ...(existing.meta ?? {}),
        stage: Math.max(3, Number(existing.meta?.stage ?? 3)),
        imagesEnriched: enrichedSlides.some((slide) => !!slide?.image_url),
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
