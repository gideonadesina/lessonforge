import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUserClient } from "@/lib/planning/notifications";
import { getTeachingTip } from "@/lib/planning/teachingTip";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

type TipPayload = {
  topic?: string;
  class_name?: string;
  subject?: string;
};

export async function POST(req: NextRequest) {
  try {
    const auth = await getAuthenticatedUserClient(req);
    if (!auth.ok || !auth.user) {
      return NextResponse.json(
        { ok: false, error: auth.error ?? "Unauthorized" },
        { status: auth.status ?? 401 }
      );
    }

    const body = (await req.json().catch(() => null)) as TipPayload | null;
    const topic = String(body?.topic ?? "").trim();
    const className = String(body?.class_name ?? "").trim();
    const subject = String(body?.subject ?? "").trim();

    if (!topic || !className || !subject) {
      return NextResponse.json(
        { ok: false, error: "topic, class_name, and subject are required." },
        { status: 400 }
      );
    }

    const result = await getTeachingTip({
      supabase: auth.supabase,
      userId: auth.user.id,
      topic,
      className,
      subject,
    });

    return NextResponse.json(
      { ok: true, data: { tip: result.tip, cached: result.cached } },
      { status: 200 }
    );
  } catch (error: unknown) {
    const fallbackTip =
      "Begin with a question your students can answer from experience — it activates prior knowledge before new content.";
    const message =
      error instanceof Error ? error.message : "Failed to generate teaching tip.";
    return NextResponse.json(
      { ok: true, data: { tip: fallbackTip, cached: false, error: message } },
      { status: 200 }
    );
  }
}
