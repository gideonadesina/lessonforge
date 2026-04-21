import type { SchemeOfWorkRow, TermProgress, TermProgressSubject } from "@/lib/planning/types";
import type { SupabaseClient } from "@supabase/supabase-js";

export function getCurrentUtcWeekNumber(now = new Date()) {
  const startOfYear = Date.UTC(now.getUTCFullYear(), 0, 1);
  const currentDay = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  const dayOfYear = Math.floor((currentDay - startOfYear) / 86400000) + 1;
  return Math.max(1, Math.ceil(dayOfYear / 7));
}

export function buildTermProgressFromSchemeRows(rows: SchemeOfWorkRow[], weekNumber: number): TermProgress {
  const bySubject = new Map<string, SchemeOfWorkRow[]>();
  for (const row of rows) {
    const key = row.subject?.trim() || "General";
    const bucket = bySubject.get(key) ?? [];
    bucket.push(row);
    bySubject.set(key, bucket);
  }

  const subjects: TermProgressSubject[] = [];
  for (const [subject, subjectRows] of bySubject.entries()) {
    const total = subjectRows.length;
    const done = subjectRows.filter((item) => item.status === "completed").length;
    const behind = subjectRows.filter(
      (item) => item.week_number < weekNumber && item.status !== "completed"
    ).length;
    const percent = total > 0 ? Math.round((done / total) * 100) : 0;
    subjects.push({
      subject,
      done,
      total,
      percent,
      behind,
    });
  }

  subjects.sort((a, b) => a.subject.localeCompare(b.subject));
  return {
    week_number: weekNumber,
    subjects,
  };
}

export async function computeTermProgress(supabase: SupabaseClient, userId: string) {
  const weekNumber = getCurrentUtcWeekNumber();

  const { data, error } = await supabase
    .from("scheme_of_work")
    .select(
      "id, user_id, class_name, subject, term, week_number, topic, subtopic, status, created_at"
    )
    .eq("user_id", userId)
    .order("subject", { ascending: true })
    .order("week_number", { ascending: true });

  if (error) {
    throw new Error(error.message);
  }

  return buildTermProgressFromSchemeRows((data ?? []) as SchemeOfWorkRow[], weekNumber);
}
