import { NextRequest, NextResponse } from "next/server";
import {
  getBearerTokenFromHeaders,
  jsonError,
  supabaseWithToken,
  utcNowIso,
} from "@/lib/planning/notifications";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function POST(req: NextRequest) {
  try {
    const token = getBearerTokenFromHeaders(req.headers);
    if (!token) {
      return jsonError("Unauthorized", 401);
    }

    const supabase = supabaseWithToken(token);
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return jsonError("Unauthorized", 401);
    }

    const now = utcNowIso();

    const { error } = await (supabase as any)
      .from("notifications")
      .update({ read_at: now })
      .eq("user_id", user.id)
      .is("read_at", null);

    if (error) {
      return jsonError(error.message, 500);
    }

    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (error: unknown) {
    const message =
      error instanceof Error
        ? error.message
        : "Failed to mark notifications as read.";
    return jsonError(message, 500);
  }
}
