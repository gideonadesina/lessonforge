import { NextRequest, NextResponse } from "next/server";
import { getAuthUserFromToken, getBearerTokenFromHeaders } from "@/lib/planning/notifications";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(req: NextRequest) {
  try {
    const token = getBearerTokenFromHeaders(req.headers);
    const auth = await getAuthUserFromToken(token);
    if (!auth.ok || !auth.supabase || !auth.user) {
      return NextResponse.json(
        { ok: false, error: auth.error ?? "Unauthorized" },
        { status: auth.status ?? 401 }
      );
    }

    const { data: notifications, error: notificationsError } = await auth.supabase
      .from("notifications")
      .select(
        "id, user_id, title, type, read, notification_type, message, sub_message, action_label, action_url, timetable_slot_id, dismissed_at, read_at, notification_date, created_at"
      )
      .eq("user_id", auth.user.id)
      .is("dismissed_at", null)
      .order("created_at", { ascending: false });

    if (notificationsError) {
      return NextResponse.json(
        { ok: false, error: notificationsError.message },
        { status: 500 }
      );
    }

    const { count: unreadCount, error: unreadCountError } = await auth.supabase
      .from("notifications")
      .select("id", { count: "exact", head: true })
      .eq("user_id", auth.user.id)
      .is("dismissed_at", null)
      .eq("read", false);

    if (unreadCountError) {
      return NextResponse.json(
        { ok: false, error: unreadCountError.message },
        { status: 500 }
      );
    }

    return NextResponse.json(
      {
        ok: true,
        data: {
          notifications: notifications ?? [],
          unreadCount: unreadCount ?? 0,
        },
      },
      { status: 200 }
    );
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : "Failed to load notifications";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
