import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUserClient, jsonError } from "@/lib/planning/notifications";
import { computeTermProgress } from "@/lib/planning/termProgress";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(req: NextRequest) {
  try {
    const auth = await getAuthenticatedUserClient(req);
    if (!auth.ok || !auth.supabase || !auth.user) {
      return jsonError(auth.error ?? "Unauthorized", auth.status ?? 401);
    }

    const progress = await computeTermProgress(auth.supabase, auth.user.id);
    return NextResponse.json({ ok: true, data: progress }, { status: 200 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to load term progress.";
    return jsonError(message, 500);
  }
}
