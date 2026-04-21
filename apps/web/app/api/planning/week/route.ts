import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUserClient } from "@/lib/planning/notifications";
import { getCurrentUtcWeekRange, getWeekSlotsByDay } from "@/lib/planning/timetable";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

function weekdayFromDateIso(dateIso: string) {
  const date = new Date(`${dateIso}T00:00:00Z`);
  const day = date.getUTCDay();
  if (day === 1) return "Mon";
  if (day === 2) return "Tue";
  if (day === 3) return "Wed";
  if (day === 4) return "Thu";
  if (day === 5) return "Fri";
  return null;
}

export async function GET(req: NextRequest) {
  try {
    const auth = await getAuthenticatedUserClient(req);
    if (!auth.ok || !auth.supabase || !auth.user) {
      return NextResponse.json(
        { ok: false, error: auth.error ?? "Unauthorized" },
        { status: auth.status ?? 401 }
      );
    }

    const db = auth.supabase as any;
    const user = auth.user;
    const weekRange = getCurrentUtcWeekRange();

    const [slotsByDay, eventsRes] = await Promise.all([
      getWeekSlotsByDay(auth.supabase, user.id),
      db
        .from("academic_calendar")
        .select("id, title, event_date, event_type")
        .eq("user_id", user.id)
        .gte("event_date", weekRange.mondayIso)
        .lte("event_date", weekRange.fridayIso)
        .order("event_date", { ascending: true }),
    ]);

    if (eventsRes.error) {
      return NextResponse.json(
        { ok: false, error: eventsRes.error.message },
        { status: 500 }
      );
    }

   type EventItem = {
  id: string;
  title: string;
  event_type: string;
  event_date: string;
};

const eventsByDay: Record<string, EventItem[]> = {
  Mon: [],
  Tue: [],
  Wed: [],
  Thu: [],
  Fri: [],
};
    for (const event of eventsRes.data ?? []) {
      const dayLabel = weekdayFromDateIso(event.event_date);
      if (!dayLabel || !eventsByDay[dayLabel]) continue;
      eventsByDay[dayLabel].push({
        id: event.id,
        title: event.title,
        event_type: event.event_type,
        event_date: event.event_date,
      });
    }

    return NextResponse.json(
      {
        ok: true,
        data: {
          slots_by_day: slotsByDay,
          events_by_day: eventsByDay,
        },
      },
      { status: 200 }
    );
  } catch (error: unknown) {
    const message =
      error instanceof Error
        ? error.message
        : "Failed to load weekly planning data.";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}