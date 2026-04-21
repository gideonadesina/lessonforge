import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  AcademicCalendarInput,
  AcademicCalendarRow,
} from "@/lib/planning/types";

export async function listAcademicEvents(
  supabase: SupabaseClient,
  userId: string
) {
  const { data, error } = await supabase
    .from("academic_calendar")
    .select(
      "id, user_id, title, event_date, end_date, event_type, affected_classes, notification_sent, description, created_at"
    )
    .eq("user_id", userId)
    .order("event_date", { ascending: true })
    .order("created_at", { ascending: true });

  return {
    data: (data ?? []) as AcademicCalendarRow[],
    error,
  };
}

export async function createAcademicEvent(
  supabase: SupabaseClient,
  userId: string,
  input: AcademicCalendarInput
) {
  const payload = {
    user_id: userId,
    title: input.title.trim(),
    event_date: input.event_date,
    end_date: input.end_date || null,
    event_type: input.event_type,
    affected_classes:
      input.affected_classes && input.affected_classes.length > 0
        ? input.affected_classes
        : null,
    notification_sent: Boolean(input.notification_sent),
    description: input.description?.trim() || null,
  };

  const { error } = await supabase.from("academic_calendar").insert(payload);
  return { error };
}

export async function updateAcademicEvent(
  supabase: SupabaseClient,
  userId: string,
  id: string,
  input: AcademicCalendarInput
) {
  const payload = {
    title: input.title.trim(),
    event_date: input.event_date,
    end_date: input.end_date || null,
    event_type: input.event_type,
    affected_classes:
      input.affected_classes && input.affected_classes.length > 0
        ? input.affected_classes
        : null,
    notification_sent: Boolean(input.notification_sent),
    description: input.description?.trim() || null,
  };

  const { error } = await supabase
    .from("academic_calendar")
    .update(payload)
    .eq("id", id)
    .eq("user_id", userId);

  return { error };
}

export async function deleteAcademicEvent(
  supabase: SupabaseClient,
  userId: string,
  id: string
) {
  const { error } = await supabase
    .from("academic_calendar")
    .delete()
    .eq("id", id)
    .eq("user_id", userId);

  return { error };
}