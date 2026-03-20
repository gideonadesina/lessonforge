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