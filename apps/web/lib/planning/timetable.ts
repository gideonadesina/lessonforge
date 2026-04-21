import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  TodaySlot,
  TeacherTimetable,
  TeacherTimetableInput,
  TimetableSlot,
  TimetableSlotInput,
} from "@/lib/planning/types";

export function utcIsoDate(value = new Date()) {
  return value.toISOString().slice(0, 10);
}

export function utcIsoWeekday(value = new Date()) {
  const day = value.getUTCDay();
  return day === 0 ? 7 : day;
}

export function weekdayLabel(dayOfWeek: number): "Mon" | "Tue" | "Wed" | "Thu" | "Fri" | "Sat" | "Sun" {
  if (dayOfWeek === 1) return "Mon";
  if (dayOfWeek === 2) return "Tue";
  if (dayOfWeek === 3) return "Wed";
  if (dayOfWeek === 4) return "Thu";
  if (dayOfWeek === 5) return "Fri";
  if (dayOfWeek === 6) return "Sat";
  return "Sun";
}

export function startOfUtcWeek(date = new Date()) {
  const current = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const currentIsoDay = utcIsoWeekday(date);
  current.setUTCDate(current.getUTCDate() - (currentIsoDay - 1));
  return current;
}

export function endOfUtcWeek(date = new Date()) {
  const start = startOfUtcWeek(date);
  const end = new Date(start);
  end.setUTCDate(start.getUTCDate() + 6);
  return end;
}

export function combineUtcDateAndTime(isoDate: string, timeValue: string) {
  const normalized = timeValue.length === 5 ? `${timeValue}:00` : timeValue;
  return new Date(`${isoDate}T${normalized}Z`);
}

export function getUtcNowDayRange(now = new Date()) {
  const start = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 0, 0, 0, 0)
  );
  const end = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 23, 59, 59, 999)
  );
  return {
    start: start.toISOString(),
    end: end.toISOString(),
    isoWeekday: utcIsoWeekday(now),
    todayIso: utcIsoDate(now),
  };
}

export function toMonFriUtcRange(now = new Date()) {
  const monday = startOfUtcWeek(now);
  const friday = new Date(monday);
  friday.setUTCDate(monday.getUTCDate() + 4);
  return {
    weekStart: monday.toISOString(),
    weekEnd: new Date(
      Date.UTC(
        friday.getUTCFullYear(),
        friday.getUTCMonth(),
        friday.getUTCDate(),
        23,
        59,
        59,
        999
      )
    ).toISOString(),
    mondayIso: utcIsoDate(monday),
    fridayIso: utcIsoDate(friday),
  };
}

export function getCurrentUtcWeekRange(now = new Date()) {
  const range = toMonFriUtcRange(now);
  return {
    mondayIso: range.mondayIso,
    fridayIso: range.fridayIso,
  };
}

type SlotTemporalBase = {
  id: string;
  start_time: string;
  duration_minutes: number;
};

export function computeTodaySlotStatuses(slots: SlotTemporalBase[], now = new Date()) {
  const todayIso = utcIsoDate(now);
  const sorted = [...slots].sort((a, b) => a.start_time.localeCompare(b.start_time));
  const result = new Map<string, "now" | "next" | "later">();

  let nextSlotId: string | null = null;

  for (const slot of sorted) {
    const start = combineUtcDateAndTime(todayIso, slot.start_time);
    const end = new Date(start.getTime() + slot.duration_minutes * 60_000);
    if (now >= start && now <= end) {
      result.set(slot.id, "now");
      continue;
    }
    if (start > now && !nextSlotId) {
      nextSlotId = slot.id;
    }
    result.set(slot.id, "later");
  }

  if (nextSlotId && result.get(nextSlotId) !== "now") {
    result.set(nextSlotId, "next");
  }

  return result;
}

function dayLabelToIsoDay(dayLabel: "Mon" | "Tue" | "Wed" | "Thu" | "Fri") {
  if (dayLabel === "Mon") return 1;
  if (dayLabel === "Tue") return 2;
  if (dayLabel === "Wed") return 3;
  if (dayLabel === "Thu") return 4;
  return 5;
}

type SlotDbRow = {
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

type SchemeDbRow = {
  id: string;
  topic: string;
  week_number: number;
  status: "not_started" | "in_progress" | "completed";
};

export async function getWeekSlotsByDay(
  supabase: SupabaseClient,
  userId: string,
  todayIso = utcIsoDate()
) {
  const labels: Array<"Mon" | "Tue" | "Wed" | "Thu" | "Fri"> = [
    "Mon",
    "Tue",
    "Wed",
    "Thu",
    "Fri",
  ];
  const slotsByDay: Record<"Mon" | "Tue" | "Wed" | "Thu" | "Fri", TodaySlot[]> = {
    Mon: [],
    Tue: [],
    Wed: [],
    Thu: [],
    Fri: [],
  };

  const { data: timetable } = await supabase
    .from("teacher_timetable")
    .select("id")
    .eq("user_id", userId)
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!timetable?.id) {
    return slotsByDay;
  }

  const slotsRes = await supabase
    .from("timetable_slots")
    .select(
      "id, timetable_id, day_of_week, start_time, duration_minutes, class_name, subject, room, scheme_entry_id, created_at"
    )
    .eq("timetable_id", timetable.id)
    .in("day_of_week", [1, 2, 3, 4, 5])
    .order("day_of_week", { ascending: true })
    .order("start_time", { ascending: true });

  if (slotsRes.error) {
    return slotsByDay;
  }

  const slots = (slotsRes.data ?? []) as SlotDbRow[];
  const schemeIds = Array.from(
    new Set(slots.map((slot) => slot.scheme_entry_id).filter(Boolean))
  ) as string[];

  const [schemeRes, lessonsRes, viewsRes] = await Promise.all([
    schemeIds.length
      ? supabase
          .from("scheme_of_work")
          .select("id, topic, week_number, status")
          .eq("user_id", userId)
          .in("id", schemeIds)
      : Promise.resolve({ data: [], error: null } as const),
    supabase.from("lessons").select("topic").eq("user_id", userId).limit(1000),
    supabase
      .from("lesson_pack_views")
      .select("timetable_slot_id")
      .eq("user_id", userId)
      .eq("view_date", todayIso),
  ]);

  const schemeMap = new Map<string, SchemeDbRow>();
  for (const row of (schemeRes.data ?? []) as SchemeDbRow[]) {
    schemeMap.set(row.id, row);
  }

  const lessonTopics = new Set(
    ((lessonsRes.data ?? []) as Array<{ topic: string | null }>).map((row) =>
      (row.topic ?? "").trim().toLowerCase()
    )
  );
  const openedToday = new Set(
    ((viewsRes.data ?? []) as Array<{ timetable_slot_id: string }>).map(
      (row) => row.timetable_slot_id
    )
  );

  const now = new Date();
  const todayWeekday = utcIsoWeekday(now);
  const todayStatusMap = computeTodaySlotStatuses(
    slots
      .filter((slot) => slot.day_of_week === todayWeekday)
      .map((slot) => ({
        id: slot.id,
        start_time: slot.start_time,
        duration_minutes: slot.duration_minutes,
      })),
    now
  );

  for (const dayLabel of labels) {
    const day = dayLabelToIsoDay(dayLabel);
    const daySlots = slots.filter((slot) => slot.day_of_week === day);
    slotsByDay[dayLabel] = daySlots.map((slot) => {
      const scheme = slot.scheme_entry_id ? schemeMap.get(slot.scheme_entry_id) ?? null : null;
      const topic = scheme?.topic ?? null;
      const lessonExists = topic ? lessonTopics.has(topic.trim().toLowerCase()) : false;
      const status =
        scheme?.status === "completed"
          ? "done"
          : day === todayWeekday
          ? todayStatusMap.get(slot.id) ?? "later"
          : "later";

      return {
        slot: {
          id: slot.id,
          timetable_id: slot.timetable_id,
          day_of_week: slot.day_of_week,
          start_time: slot.start_time,
          duration_minutes: slot.duration_minutes,
          class_name: slot.class_name,
          subject: slot.subject,
          room: slot.room,
          scheme_entry_id: slot.scheme_entry_id,
          created_at: slot.created_at,
        },
        class_name: slot.class_name,
        subject: slot.subject,
        start_time: slot.start_time,
        duration_minutes: slot.duration_minutes,
        topic,
        week_number: scheme?.week_number ?? null,
        lesson_exists: lessonExists,
        opened_today: openedToday.has(slot.id),
        status,
      };
    });
  }

  return slotsByDay;
}

export async function getLatestTeacherTimetable(
  supabase: SupabaseClient,
  userId: string
) {
  const { data, error } = await supabase
    .from("teacher_timetable")
    .select("id, user_id, term, academic_year, weeks_in_term, teaching_days, created_at, updated_at")
    .eq("user_id", userId)
    .order("updated_at", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  return {
    data: (data as TeacherTimetable | null) ?? null,
    error,
  };
}

export async function getTeacherTimetableByTermYear(
  supabase: SupabaseClient,
  userId: string,
  term: string,
  academicYear: string
) {
  const { data, error } = await supabase
    .from("teacher_timetable")
    .select("id, user_id, term, academic_year, weeks_in_term, teaching_days, created_at, updated_at")
    .eq("user_id", userId)
    .eq("term", term)
    .eq("academic_year", academicYear)
    .maybeSingle();

  return {
    data: (data as TeacherTimetable | null) ?? null,
    error,
  };
}

export async function listTimetableSlots(
  supabase: SupabaseClient,
  timetableId: string
) {
  const { data, error } = await supabase
    .from("timetable_slots")
    .select("id, timetable_id, day_of_week, start_time, duration_minutes, class_name, subject, room, scheme_entry_id, created_at")
    .eq("timetable_id", timetableId)
    .order("day_of_week", { ascending: true })
    .order("start_time", { ascending: true });

  return {
    data: (data ?? []) as TimetableSlot[],
    error,
  };
}

export async function upsertTeacherTimetable(
  supabase: SupabaseClient,
  userId: string,
  input: TeacherTimetableInput
) {
  const payload = {
    user_id: userId,
    term: input.term.trim(),
    academic_year: input.academic_year.trim(),
    weeks_in_term: input.weeks_in_term,
    teaching_days: input.teaching_days,
    updated_at: new Date().toISOString(),
  };

  const { data, error } = await supabase
    .from("teacher_timetable")
    .upsert(payload, { onConflict: "user_id,term,academic_year" })
    .select("id, user_id, term, academic_year, weeks_in_term, teaching_days, created_at, updated_at")
    .single();

  return {
    data: (data as TeacherTimetable | null) ?? null,
    error,
  };
}

export async function replaceTimetableSlots(
  supabase: SupabaseClient,
  timetableId: string,
  slots: TimetableSlotInput[]
) {
  const { error: deleteError } = await supabase
    .from("timetable_slots")
    .delete()
    .eq("timetable_id", timetableId);

  if (deleteError) {
    return { error: deleteError };
  }

  if (!slots.length) {
    return { error: null };
  }

  const payload = slots.map((slot) => ({
    timetable_id: timetableId,
    day_of_week: slot.day_of_week,
    start_time: slot.start_time,
    duration_minutes: slot.duration_minutes,
    class_name: slot.class_name.trim(),
    subject: slot.subject.trim(),
    room: slot.room?.trim() || null,
    scheme_entry_id: slot.scheme_entry_id ?? null,
  }));

  const { error } = await supabase.from("timetable_slots").insert(payload);
  return { error };
}

export async function upsertNotificationPreferences(
  supabase: SupabaseClient,
  userId: string,
  input: {
    reminder_minutes: number;
    delivery_method: "in_app" | "email" | "both";
    enabled: boolean;
  }
) {
  const payload = {
    user_id: userId,
    reminder_minutes: input.reminder_minutes,
    delivery_method: input.delivery_method,
    enabled: input.enabled,
    updated_at: new Date().toISOString(),
  };

  const { error } = await supabase
    .from("notification_preferences")
    .upsert(payload, { onConflict: "user_id" });

  return { error };
}
