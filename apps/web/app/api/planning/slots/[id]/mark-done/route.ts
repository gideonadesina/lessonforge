import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@supabase/supabase-js";
import { NotificationType } from "@/lib/planning/types";
import {
  getBearerTokenFromHeaders,
  isoDateUtc,
  toUtcIsoNow,
} from "@/lib/planning/notifications";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

function createTokenBoundClient(token: string) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  return createClient(url, anon, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
}

type SlotRow = {
  id: string;
  timetable_id: string;
  class_name: string;
  subject: string;
  start_time: string;
  scheme_entry_id: string | null;
};

type TimetableRow = {
  id: string;
  user_id: string;
};

type SchemeRow = {
  id: string;
  topic: string;
};

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const token = getBearerTokenFromHeaders(req.headers);
    if (!token) {
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }

    const supabase = createTokenBoundClient(token);
    const admin = createAdminClient();

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }

    const { id: slotId } = await context.params;
    if (!slotId) {
      return NextResponse.json(
        { ok: false, error: "Slot id is required." },
        { status: 400 }
      );
    }

    const slotRes = await admin
      .from("timetable_slots")
      .select("id, timetable_id, class_name, subject, start_time, scheme_entry_id")
      .eq("id", slotId)
      .maybeSingle();
    if (slotRes.error || !slotRes.data) {
      return NextResponse.json(
        { ok: false, error: slotRes.error?.message ?? "Slot not found." },
        { status: 404 }
      );
    }

    const slot = slotRes.data as SlotRow;
    const timetableRes = await admin
      .from("teacher_timetable")
      .select("id, user_id")
      .eq("id", slot.timetable_id)
      .maybeSingle();
    if (timetableRes.error || !timetableRes.data) {
      return NextResponse.json(
        { ok: false, error: timetableRes.error?.message ?? "Timetable not found." },
        { status: 404 }
      );
    }

    const timetable = timetableRes.data as TimetableRow;
    if (timetable.user_id !== user.id) {
      return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
    }

    let topic = "Class completed";
    if (slot.scheme_entry_id) {
      const schemeRes = await admin
        .from("scheme_of_work")
        .select("id, topic")
        .eq("id", slot.scheme_entry_id)
        .eq("user_id", user.id)
        .maybeSingle();

      if (schemeRes.error) {
        return NextResponse.json({ ok: false, error: schemeRes.error.message }, { status: 500 });
      }

      if (schemeRes.data) {
        const scheme = schemeRes.data as SchemeRow;
        topic = scheme.topic || topic;

        const updateRes = await admin
          .from("scheme_of_work")
          .update({ status: "completed" })
          .eq("id", scheme.id)
          .eq("user_id", user.id);
        if (updateRes.error) {
          return NextResponse.json({ ok: false, error: updateRes.error.message }, { status: 500 });
        }
      }
    }

    const notificationDate = isoDateUtc();
    const message = `Completed: ${slot.class_name} - ${topic}`;
    const subMessage = `${slot.subject} at ${slot.start_time}`;
    const url = `/planning`;
    const now = toUtcIsoNow();

    // Ignore duplicate insertion collisions because dedup is guaranteed by unique index.
    const notificationRes = await admin.from("notifications").insert({
      user_id: user.id,
      notification_type: NotificationType.COMPLETED,
      message,
      sub_message: subMessage,
      action_label: "View summary",
      action_url: url,
      timetable_slot_id: slot.id,
      notification_date: notificationDate,
      created_at: now,
    });

    if (notificationRes.error && notificationRes.error.code !== "23505") {
      return NextResponse.json(
        { ok: false, error: notificationRes.error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      ok: true,
      data: {
        slot_id: slot.id,
        scheme_entry_id: slot.scheme_entry_id,
        notification_date: notificationDate,
      },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to mark slot done.";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
