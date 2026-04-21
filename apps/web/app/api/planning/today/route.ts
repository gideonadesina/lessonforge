import { NextRequest, NextResponse } from "next/server";
import {
  getBearerTokenFromHeaders,
  getAuthenticatedUserClient,
  isoUtcDate,
} from "@/lib/planning/notifications";
import { computeTodaySlotStatuses, getUtcNowDayRange } from "@/lib/planning/timetable";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

type TodayApiSlotRow = {
  id: string;
  timetable_id: string;
  day_of_week: number;
  start_time: string;
  duration_minutes: number;
  class_name: string;
  subject: string;
  room: string | null;
  scheme_entry_id: string | null;
  created_at: string;
};

type TodaySchemeRow = {
  id: string;
  topic: string;
  week_number: number;
  status: "not_started" | "in_progress" | "completed";
};

export async function GET(req: NextRequest) {
  try {
    const token = getBearerTokenFromHeaders(req.headers);
    if (!token) {
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }

    const auth = await getAuthenticatedUserClient(req);
    if (!auth.ok || !auth.supabase || !auth.user) {
      return NextResponse.json(
        { ok: false, error: auth.error ?? "Unauthorized" },
        { status: auth.status ?? 401 }
      );
    }

    const now = new Date();
    const utcDate = isoUtcDate(now);
    const { isoWeekday } = getUtcNowDayRange(now);

    const timetableRes = await auth.supabase
      .from("teacher_timetable")
      .select("id")
      .eq("user_id", auth.user.id)
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (timetableRes.error) {
      return NextResponse.json({ ok: false, error: timetableRes.error.message }, { status: 500 });
    }
    if (!timetableRes.data?.id) {
      return NextResponse.json({ ok: true, data: [] }, { status: 200 });
    }

    const slotsRes = await auth.supabase
      .from("timetable_slots")
      .select("id, timetable_id, day_of_week, start_time, duration_minutes, class_name, subject, room, scheme_entry_id, created_at")
      .eq("timetable_id", timetableRes.data.id)
      .eq("day_of_week", isoWeekday)
      .order("start_time", { ascending: true });
    if (slotsRes.error) {
      return NextResponse.json({ ok: false, error: slotsRes.error.message }, { status: 500 });
    }

    const slots = (slotsRes.data ?? []) as TodayApiSlotRow[];
    if (!slots.length) {
      return NextResponse.json({ ok: true, data: [] }, { status: 200 });
    }

    const schemeIds = Array.from(
      new Set(slots.map((slot) => slot.scheme_entry_id).filter(Boolean))
    ) as string[];

    const [schemeRes, lessonsRes, viewsRes] = await Promise.all([
      schemeIds.length
        ? auth.supabase
            .from("scheme_of_work")
            .select("id, topic, week_number, status")
            .in("id", schemeIds)
            .eq("user_id", auth.user.id)
        : Promise.resolve({ data: [], error: null } as const),
      auth.supabase.from("lessons").select("id, topic").eq("user_id", auth.user.id),
      auth.supabase
        .from("lesson_pack_views")
        .select("id, timetable_slot_id")
        .eq("user_id", auth.user.id)
        .eq("view_date", utcDate),
    ]);

    if (schemeRes.error) {
      return NextResponse.json({ ok: false, error: schemeRes.error.message }, { status: 500 });
    }
    if (lessonsRes.error) {
      return NextResponse.json({ ok: false, error: lessonsRes.error.message }, { status: 500 });
    }
    if (viewsRes.error) {
      return NextResponse.json({ ok: false, error: viewsRes.error.message }, { status: 500 });
    }

    const schemeMap = new Map<string, TodaySchemeRow>();
    for (const row of (schemeRes.data ?? []) as TodaySchemeRow[]) {
      schemeMap.set(row.id, row);
    }

    const lessonTopics = new Set(
      ((lessonsRes.data ?? []) as Array<{ topic: string | null }>).map((row) =>
        (row.topic ?? "").trim().toLowerCase()
      )
    );
    const openedSlotIds = new Set(
      ((viewsRes.data ?? []) as Array<{ timetable_slot_id: string }>).map(
        (row) => row.timetable_slot_id
      )
    );

    const statusMap = computeTodaySlotStatuses(
      slots.map((slot) => ({
        id: slot.id,
        start_time: slot.start_time,
        duration_minutes: slot.duration_minutes,
      })),
      now
    );

    const payload = slots.map((slot) => {
      const scheme = slot.scheme_entry_id ? schemeMap.get(slot.scheme_entry_id) ?? null : null;
      const topic = scheme?.topic ?? null;
      const lessonExists = topic ? lessonTopics.has(topic.trim().toLowerCase()) : false;
      const done = scheme?.status === "completed";
      const temporal = statusMap.get(slot.id) ?? "later";
      const status = done ? "done" : temporal;

      return {
        slot,
        class_name: slot.class_name,
        subject: slot.subject,
        start_time: slot.start_time,
        duration_minutes: slot.duration_minutes,
        topic,
        week_number: scheme?.week_number ?? null,
        lesson_exists: lessonExists,
        opened_today: openedSlotIds.has(slot.id),
        status,
      };
    });

    return NextResponse.json({ ok: true, data: payload }, { status: 200 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to load today's planning slots.";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
