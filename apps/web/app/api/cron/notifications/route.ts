import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isoUtcDate, startTimeToUtcDate, utcDayOfWeek, withMinutesOffset } from "@/lib/planning/notifications";

// Called by external scheduler every 15 minutes.
// Configure in Vercel dashboard cron settings or Supabase pg_cron.
// NOTE: Vercel Hobby limits cron to daily. Upgrade to Vercel Pro for 15-min schedule.

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

type TeacherTimetableRow = {
  id: string;
  user_id: string;
};

type SlotRow = {
  id: string;
  timetable_id: string;
  day_of_week: number;
  start_time: string;
  duration_minutes: number;
  class_name: string;
  subject: string;
  scheme_entry_id: string | null;
};

type SchemeEntryRow = {
  id: string;
  user_id: string;
  topic: string;
};

type NotificationPrefRow = {
  user_id: string;
  reminder_minutes: number;
  enabled: boolean;
};

function parseHourMinute(startTime: string) {
  const [hourRaw, minuteRaw] = startTime.split(":");
  const hour = Number(hourRaw ?? "0");
  const minute = Number(minuteRaw ?? "0");
  return {
    hour: Number.isFinite(hour) ? hour : 0,
    minute: Number.isFinite(minute) ? minute : 0,
  };
}

async function lessonExistsForTopic(
  admin: ReturnType<typeof createAdminClient>,
  userId: string,
  topic: string
) {
  const { data, error } = await admin
    .from("lessons")
    .select("id")
    .eq("user_id", userId)
    .ilike("topic", topic)
    .limit(1)
    .maybeSingle();
  if (error) return false;
  return Boolean(data?.id);
}

async function hasAnyPackViewForSlot(
  admin: ReturnType<typeof createAdminClient>,
  userId: string,
  slotId: string
) {
  const { data, error } = await (admin as any)
    .from("lesson_pack_views")
    .select("id")
    .eq("user_id", userId)
    .eq("timetable_slot_id", slotId)
    .limit(1)
    .maybeSingle();
  if (error) return false;
  return Boolean(data?.id);
}

async function hasTodayPackViewForSlot(
  admin: ReturnType<typeof createAdminClient>,
  userId: string,
  slotId: string,
  today: string
) {
  const { data, error } = await (admin as any)
    .from("lesson_pack_views")
    .select("id")
    .eq("user_id", userId)
    .eq("timetable_slot_id", slotId)
    .eq("view_date", today)
    .limit(1)
    .maybeSingle();
  if (error) return false;
  return Boolean(data?.id);
}

export async function POST() {
  try {
    const admin = createAdminClient();
    const now = new Date();
    const today = isoUtcDate();
    const dow = utcDayOfWeek(now);
    const in48h = withMinutesOffset(now, 48 * 60);

    const [timetableRes, prefRes] = await Promise.all([
      (admin as any).from("teacher_timetable").select("id, user_id"),
      (admin as any).from("notification_preferences").select("user_id, reminder_minutes, enabled"),
    ]);

    if (timetableRes.error) {
      return NextResponse.json(
        { ok: false, error: timetableRes.error.message },
        { status: 500 }
      );
    }
    if (prefRes.error) {
      return NextResponse.json(
        { ok: false, error: prefRes.error.message },
        { status: 500 }
      );
    }

    const timetables = (timetableRes.data ?? []) as TeacherTimetableRow[];
    const prefMap = new Map<string, NotificationPrefRow>();
    for (const pref of (prefRes.data ?? []) as NotificationPrefRow[]) {
      prefMap.set(pref.user_id, pref);
    }

    let insertedCount = 0;

    for (const timetable of timetables) {
      const pref = prefMap.get(timetable.user_id);
      if (pref && !pref.enabled) continue;
      const reminderMinutes = Math.max(1, Number(pref?.reminder_minutes ?? 30));

      const { data: slots, error: slotsErr } = await (admin as any)
        .from("timetable_slots")
        .select("id, timetable_id, day_of_week, start_time, duration_minutes, class_name, subject, scheme_entry_id")
        .eq("timetable_id", timetable.id)
        .eq("day_of_week", dow)
        .order("start_time", { ascending: true });

      if (slotsErr) continue;

      for (const slot of (slots ?? []) as SlotRow[]) {
        let schemeTopic = "";
        let schemeExists = false;

        if (slot.scheme_entry_id) {
          const { data: schemeRow } = await admin
            .from("scheme_of_work")
            .select("id, user_id, topic")
            .eq("id", slot.scheme_entry_id)
            .eq("user_id", timetable.user_id)
            .maybeSingle();
          const scheme = (schemeRow ?? null) as SchemeEntryRow | null;
          if (scheme?.id) {
            schemeExists = true;
            schemeTopic = scheme.topic;
          }
        }

        const hm = parseHourMinute(slot.start_time);
        const slotStart = startTimeToUtcDate(now, hm.hour, hm.minute);
        const reminderStart = withMinutesOffset(slotStart, -reminderMinutes);
        const withinReminderWindow = now >= reminderStart && now <= slotStart;
        const within48Hours = slotStart >= now && slotStart <= in48h;

        const [openedToday, anyViewForSlot] = await Promise.all([
          hasTodayPackViewForSlot(admin, timetable.user_id, slot.id, today),
          hasAnyPackViewForSlot(admin, timetable.user_id, slot.id),
        ]);

        const hasLessonForTopic = schemeTopic
          ? await lessonExistsForTopic(admin, timetable.user_id, schemeTopic)
          : false;

        // URGENT: within reminder window and not opened today
        if (withinReminderWindow && !openedToday) {
          const fallbackMissingLesson = !anyViewForSlot && schemeExists && !hasLessonForTopic;
          const shouldFireUrgent = anyViewForSlot
            ? true
            : fallbackMissingLesson || !schemeExists;

          if (shouldFireUrgent) {
            const urgentMsg = schemeTopic
              ? `Class starts soon: ${slot.class_name} - ${schemeTopic}`
              : `Class starts soon: ${slot.class_name}`;

            const { error: urgentErr } = await (admin as any)
              .from("notifications")
              .insert({
                user_id: timetable.user_id,
                timetable_slot_id: slot.id,
                notification_type: "URGENT",
                notification_date: today,
                message: urgentMsg,
                sub_message: `Starts at ${slot.start_time} UTC`,
                action_label: "Open lesson pack",
                action_url: "/planning",
              });

            if (!urgentErr) insertedCount += 1;
          }
        }

        // PREP_WARNING: within 48 hours, has linked scheme, no lesson exists
        if (within48Hours && schemeExists && !hasLessonForTopic) {
          const { error: prepErr } = await (admin as any)
            .from("notifications")
            .insert({
              user_id: timetable.user_id,
              timetable_slot_id: slot.id,
              notification_type: "PREP_WARNING",
              notification_date: today,
              message: `Prepare lesson for ${slot.class_name}`,
              sub_message: `${schemeTopic} is within 48 hours`,
              action_label: "Generate lesson",
              action_url: "/generate",
            });

          if (!prepErr) insertedCount += 1;
        }
      }
    }

    return NextResponse.json(
      { ok: true, data: { inserted: insertedCount } },
      { status: 200 }
    );
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : "Failed to run notifications engine";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
