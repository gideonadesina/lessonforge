import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  SchemeOfWorkFilters,
  SchemeOfWorkInput,
  SchemeOfWorkRow,
} from "@/lib/planning/types";

export async function listSchemeOfWork(
  supabase: SupabaseClient,
  userId: string,
  filters?: SchemeOfWorkFilters
) {
  let query = supabase
    .from("scheme_of_work")
    .select(
      "id, user_id, class_name, subject, term, week_number, topic, subtopic, status, created_at"
    )
    .eq("user_id", userId)
    .order("week_number", { ascending: true })
    .order("created_at", { ascending: true });

  if (filters?.class_name) {
    query = query.ilike("class_name", `%${filters.class_name.trim()}%`);
  }

  if (filters?.subject) {
    query = query.ilike("subject", `%${filters.subject.trim()}%`);
  }

  if (filters?.term) {
    query = query.ilike("term", `%${filters.term.trim()}%`);
  }

  const { data, error } = await query;
  return {
    data: (data ?? []) as SchemeOfWorkRow[],
    error,
  };
}

export async function createSchemeEntry(
  supabase: SupabaseClient,
  userId: string,
  input: SchemeOfWorkInput
) {
  const payload = {
    user_id: userId,
    class_name: input.class_name.trim(),
    subject: input.subject.trim(),
    term: input.term.trim(),
    week_number: input.week_number,
    topic: input.topic.trim(),
    subtopic: input.subtopic?.trim() || null,
    status: input.status,
  };

  const { error } = await supabase.from("scheme_of_work").insert(payload);
  return { error };
}

export async function updateSchemeEntry(
  supabase: SupabaseClient,
  userId: string,
  id: string,
  input: SchemeOfWorkInput
) {
  const payload = {
    class_name: input.class_name.trim(),
    subject: input.subject.trim(),
    term: input.term.trim(),
    week_number: input.week_number,
    topic: input.topic.trim(),
    subtopic: input.subtopic?.trim() || null,
    status: input.status,
  };

  const { error } = await supabase
    .from("scheme_of_work")
    .update(payload)
    .eq("id", id)
    .eq("user_id", userId);

  return { error };
}

export async function deleteSchemeEntry(
  supabase: SupabaseClient,
  userId: string,
  id: string
) {
  const { error } = await supabase
    .from("scheme_of_work")
    .delete()
    .eq("id", id)
    .eq("user_id", userId);

  return { error };
}

export async function listUserTimetableSlotsBySubject(
  supabase: SupabaseClient,
  userId: string,
  subject?: string
) {
  const timetableRes = await supabase
    .from("teacher_timetable")
    .select("id")
    .eq("user_id", userId)
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (timetableRes.error) {
    return { data: [], error: timetableRes.error };
  }

  if (!timetableRes.data?.id) {
    return { data: [], error: null };
  }

  let slotQuery = supabase
    .from("timetable_slots")
    .select(
      "id, day_of_week, start_time, duration_minutes, class_name, subject, scheme_entry_id"
    )
    .eq("timetable_id", timetableRes.data.id)
    .order("day_of_week", { ascending: true })
    .order("start_time", { ascending: true });

  if (subject?.trim()) {
    slotQuery = slotQuery.ilike("subject", subject.trim());
  }

  const { data, error } = await slotQuery;
  return {
    data:
      (data ?? []) as Array<{
        id: string;
        day_of_week: number;
        start_time: string;
        duration_minutes: number;
        class_name: string;
        subject: string;
        scheme_entry_id: string | null;
      }>,
    error,
  };
}

export async function linkSchemeEntryToTimetableSlot(
  supabase: SupabaseClient,
  userId: string,
  schemeEntryId: string,
  timetableSlotId: string
) {
  const slotRes = await supabase
    .from("timetable_slots")
    .select("id, timetable_id")
    .eq("id", timetableSlotId)
    .maybeSingle();

  if (slotRes.error || !slotRes.data?.id) {
    return { error: slotRes.error ?? new Error("Timetable slot not found.") };
  }

  const ownerRes = await supabase
    .from("teacher_timetable")
    .select("id")
    .eq("id", slotRes.data.timetable_id)
    .eq("user_id", userId)
    .maybeSingle();

  if (ownerRes.error || !ownerRes.data?.id) {
    return { error: ownerRes.error ?? new Error("Forbidden") };
  }

  const { error } = await supabase
    .from("timetable_slots")
    .update({ scheme_entry_id: schemeEntryId })
    .eq("id", timetableSlotId);

  return { error };
}

export async function markSchemeEntryCompleted(
  supabase: SupabaseClient,
  userId: string,
  schemeEntryId: string
) {
  const { error } = await supabase
    .from("scheme_of_work")
    .update({ status: "completed" })
    .eq("id", schemeEntryId)
    .eq("user_id", userId);

  return { error };
}

export async function listTimetableSlotsByUser(
  supabase: SupabaseClient,
  userId: string
) {
  return listUserTimetableSlotsBySubject(supabase, userId);
}

export async function assignSchemeEntryToTimetableSlot(
  supabase: SupabaseClient,
  userId: string,
  schemeEntryId: string,
  timetableSlotId: string | null
) {
  if (!timetableSlotId) {
    const { error } = await supabase
      .from("timetable_slots")
      .update({ scheme_entry_id: null })
      .eq("scheme_entry_id", schemeEntryId);
    return { error };
  }

  return linkSchemeEntryToTimetableSlot(
    supabase,
    userId,
    schemeEntryId,
    timetableSlotId
  );
}