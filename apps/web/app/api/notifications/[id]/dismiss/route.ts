import { NextRequest, NextResponse } from "next/server";
import {
  getBearerTokenFromHeaders,
  resolveAuthenticatedUser,
  userScopedSupabaseClient,
} from "@/lib/planning/notifications";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function POST(req: NextRequest, context: RouteContext) {
  try {
    const token = getBearerTokenFromHeaders(req.headers);
    if (!token) {
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }

    const supabase = userScopedSupabaseClient(token);
    const user = await resolveAuthenticatedUser(supabase);
    if (!user) {
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await context.params;
    if (!id) {
      return NextResponse.json({ ok: false, error: "Notification id is required." }, { status: 400 });
    }

    const nowIso = new Date().toISOString();
    const { error } = await supabase
      .from("notifications")
      .update({ dismissed_at: nowIso })
      .eq("id", id)
      .eq("user_id", user.id);

    if (error) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to dismiss notification.";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
