"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createBrowserSupabase } from "@/lib/supabase/browser";
import type { NotificationPreferencesInput, TimetableSlotInput } from "@/lib/planning/types";

type DayLabel = "Mon" | "Tue" | "Wed" | "Thu" | "Fri";
type SubjectOption =
  | "Physics"
  | "Chemistry"
  | "Maths"
  | "Biology"
  | "English"
  | "Other";

type SlotDraft = {
  id: string;
  day: DayLabel;
  class_name: string;
  subject: SubjectOption;
  start_time: string;
  duration_minutes: 30 | 40 | 45 | 60;
  room: string;
  scheme_entry_id?: string | null;
};

type TermStructure = {
  weeks_in_term: number;
  term: "First Term" | "Second Term" | "Third Term";
  academic_year: string;
};

type Preferences = NotificationPreferencesInput;

type SetupPayload = {
  timetable: {
    term: string;
    academic_year: string;
    weeks_in_term: number;
    teaching_days: string[];
  };
  slots: TimetableSlotInput[];
  preferences: Preferences;
};

type SavedSlotRow = {
  id: string;
  day_of_week: number;
  start_time: string;
  duration_minutes: number;
  class_name: string;
  subject: string;
  room: string | null;
  scheme_entry_id: string | null;
};

type SchemeRow = {
  id: string;
  class_name: string;
  subject: string;
  term: string;
  week_number: number;
  topic: string;
};

const DAY_OPTIONS: DayLabel[] = ["Mon", "Tue", "Wed", "Thu", "Fri"];

function dayToIso(day: DayLabel) {
  if (day === "Mon") return 1;
  if (day === "Tue") return 2;
  if (day === "Wed") return 3;
  if (day === "Thu") return 4;
  return 5;
}

function isoToDay(day: number): DayLabel {
  if (day === 1) return "Mon";
  if (day === 2) return "Tue";
  if (day === 3) return "Wed";
  if (day === 4) return "Thu";
  return "Fri";
}

function makeSlot(day: DayLabel): SlotDraft {
  return {
    id: crypto.randomUUID(),
    day,
    class_name: "",
    subject: "Physics",
    start_time: "08:00",
    duration_minutes: 40,
    room: "",
    scheme_entry_id: null,
  };
}

async function getToken() {
  const supabase = createBrowserSupabase();
  const {
    data: { session },
  } = await supabase.auth.getSession();
  return session?.access_token ?? "";
}

async function apiFetch(path: string, init?: RequestInit) {
  const token = await getToken();
  if (!token) throw new Error("Unauthorized");
  return fetch(path, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      ...(init?.headers ?? {}),
    },
    cache: "no-store",
  });
}

export default function TimetableSetupWizard({ initialStep = 1 }: { initialStep?: number }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const supabase = useMemo(() => createBrowserSupabase(), []);

  const queryStep = Number(searchParams.get("step") ?? String(initialStep));
  const [step, setStep] = useState(Math.min(4, Math.max(1, queryStep)));
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [term, setTerm] = useState<TermStructure>({
    weeks_in_term: 12,
    term: "First Term",
    academic_year: "2025/2026",
  });
  const [teachingDays, setTeachingDays] = useState<DayLabel[]>([
    "Mon",
    "Tue",
    "Wed",
    "Thu",
    "Fri",
  ]);
  const [slots, setSlots] = useState<SlotDraft[]>(DAY_OPTIONS.map((day) => makeSlot(day)));
  const [preferences, setPreferences] = useState<Preferences>({
    reminder_minutes: 30,
    delivery_method: "in_app",
    enabled: true,
  });

  const [savedSlots, setSavedSlots] = useState<SavedSlotRow[]>([]);
  const [schemeRows, setSchemeRows] = useState<SchemeRow[]>([]);

  useEffect(() => {
    const nextStep = Number(searchParams.get("step") ?? String(initialStep));
    setStep(Math.min(4, Math.max(1, nextStep)));
  }, [initialStep, searchParams]);

  useEffect(() => {
    let active = true;
    async function loadInitial() {
      setLoading(true);
      setError(null);
      try {
        const {
          data: { user },
          error: userErr,
        } = await supabase.auth.getUser();
        if (userErr || !user) throw new Error("Unauthorized");

        const [ttRes, prefRes, schemeRes] = await Promise.all([
          supabase
            .from("teacher_timetable")
            .select("id, term, academic_year, weeks_in_term, teaching_days")
            .eq("user_id", user.id)
            .order("updated_at", { ascending: false })
            .limit(1)
            .maybeSingle(),
          supabase
            .from("notification_preferences")
            .select("reminder_minutes, delivery_method, enabled")
            .eq("user_id", user.id)
            .limit(1)
            .maybeSingle(),
          supabase
            .from("scheme_of_work")
            .select("id, class_name, subject, term, week_number, topic")
            .eq("user_id", user.id)
            .order("week_number", { ascending: true }),
        ]);

        if (ttRes.error) throw new Error(ttRes.error.message);
        if (prefRes.error) throw new Error(prefRes.error.message);
        if (schemeRes.error) throw new Error(schemeRes.error.message);

        if (ttRes.data) {
          setTerm({
            weeks_in_term: ttRes.data.weeks_in_term,
            term: (ttRes.data.term as TermStructure["term"]) || "First Term",
            academic_year: ttRes.data.academic_year,
          });

          const daySet = (ttRes.data.teaching_days ?? []).filter((d: string) =>
            DAY_OPTIONS.includes(d as DayLabel)
          ) as DayLabel[];
          if (daySet.length) {
            setTeachingDays(daySet);
          }

          const slotRes = await supabase
            .from("timetable_slots")
            .select("id, day_of_week, start_time, class_name, subject, duration_minutes, room, scheme_entry_id")
            .eq("timetable_id", ttRes.data.id)
            .order("day_of_week", { ascending: true })
            .order("start_time", { ascending: true });

          if (slotRes.error) throw new Error(slotRes.error.message);

          const normalized = (slotRes.data ?? []).map((row) => ({
            id: row.id,
            day: isoToDay(row.day_of_week),
            class_name: row.class_name,
            subject: (row.subject as SubjectOption) ?? "Other",
            start_time: row.start_time.slice(0, 5),
            duration_minutes: row.duration_minutes as 30 | 40 | 45 | 60,
            room: row.room ?? "",
            scheme_entry_id: row.scheme_entry_id ?? null,
          }));

          if (normalized.length) {
            setSlots(normalized);
          }
          setSavedSlots(
            (slotRes.data ?? []).map((row) => ({
              id: row.id,
              day_of_week: row.day_of_week,
              start_time: row.start_time,
              duration_minutes: row.duration_minutes,
              class_name: row.class_name,
              subject: row.subject,
              room: row.room ?? null,
              scheme_entry_id: row.scheme_entry_id ?? null,
            }))
          );
        }

        if (prefRes.data) {
          setPreferences({
            reminder_minutes: prefRes.data.reminder_minutes,
            delivery_method: prefRes.data.delivery_method,
            enabled: prefRes.data.enabled,
          });
        }

        setSchemeRows((schemeRes.data ?? []) as SchemeRow[]);
      } catch (err: unknown) {
        if (!active) return;
        setError(err instanceof Error ? err.message : "Failed to load setup data.");
      } finally {
        if (active) setLoading(false);
      }
    }

    void loadInitial();
    return () => {
      active = false;
    };
  }, [supabase]);

  const activeSlots = slots.filter((slot) => teachingDays.includes(slot.day));

  async function saveAll(nextStep?: number) {
    const payload: SetupPayload = {
      timetable: {
        term: term.term,
        academic_year: term.academic_year.trim(),
        weeks_in_term: term.weeks_in_term,
        teaching_days: teachingDays,
      },
      slots: activeSlots.map((slot) => ({
        day_of_week: dayToIso(slot.day),
        start_time: slot.start_time,
        duration_minutes: slot.duration_minutes,
        class_name: slot.class_name,
        subject: slot.subject,
        room: slot.room || null,
        scheme_entry_id: slot.scheme_entry_id ?? null,
      })),
      preferences,
    };

    const res = await apiFetch("/api/timetable/setup", {
      method: "POST",
      body: JSON.stringify(payload),
    });
    const json = await res.json();
    if (!res.ok || !json?.ok) {
      throw new Error(json?.error ?? "Failed to save setup.");
    }

    const token = await getToken();
    const tmp = createBrowserSupabase();
    const {
      data: { user },
    } = await tmp.auth.getUser();
    if (!user) return;

    const { data: timetable } = await tmp
      .from("teacher_timetable")
      .select("id")
      .eq("user_id", user.id)
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (timetable?.id) {
      const slotRes = await fetch(`/api/planning/week`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (slotRes.ok) {
        const slotJson = await slotRes.json();
        const byDay = slotJson?.data?.slots_by_day ?? {};
        const all = Object.values(byDay).flat() as Array<{ slot: SavedSlotRow }>;
            setSavedSlots(
              all.map((item) => ({
                id: item.slot.id,
                day_of_week: item.slot.day_of_week,
                start_time: item.slot.start_time,
                duration_minutes: item.slot.duration_minutes,
                class_name: item.slot.class_name,
                subject: item.slot.subject,
                room: item.slot.room ?? null,
                scheme_entry_id: item.slot.scheme_entry_id ?? null,
              }))
            );
      }
    }

    if (nextStep) {
      router.replace(`/planning/timetable-setup?step=${nextStep}`);
      setStep(nextStep);
    }
  }

  async function onSaveAndContinue(nextStep: number) {
    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      await saveAll(nextStep);
      setMessage("Saved successfully.");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to save.");
    } finally {
      setSaving(false);
    }
  }

  function updateSlot(id: string, patch: Partial<SlotDraft>) {
    setSlots((prev) => prev.map((slot) => (slot.id === id ? { ...slot, ...patch } : slot)));
  }

  function addSlot(day: DayLabel) {
    setSlots((prev) => [...prev, makeSlot(day)]);
  }

  const optionsBySubject = useMemo(() => {
    const grouped = new Map<string, SchemeRow[]>();
    for (const row of schemeRows) {
      const key = row.subject.trim().toLowerCase();
      const bucket = grouped.get(key) ?? [];
      bucket.push(row);
      grouped.set(key, bucket);
    }
    return grouped;
  }, [schemeRows]);

  async function linkScheme(slotId: string, schemeEntryId: string | null) {
    const target = savedSlots.find((slot) => slot.id === slotId);
    if (!target) return;

    const slotPayload = savedSlots.map((slot) => ({
      day_of_week: slot.day_of_week,
      start_time: slot.start_time.slice(0, 5),
      duration_minutes: slot.duration_minutes as 30 | 40 | 45 | 60,
      class_name: slot.class_name,
      subject: slot.subject,
      room: slot.room,
      scheme_entry_id: slot.id === slotId ? schemeEntryId : slot.scheme_entry_id,
    }));

    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      const res = await apiFetch("/api/timetable/setup", {
        method: "POST",
        body: JSON.stringify({
          timetable: {
            term: term.term,
            academic_year: term.academic_year,
            weeks_in_term: term.weeks_in_term,
            teaching_days: teachingDays,
          },
          slots: slotPayload,
          preferences,
        }),
      });
      const json = await res.json();
      if (!res.ok || !json?.ok) {
        throw new Error(json?.error ?? "Failed to link scheme.");
      }
      setSavedSlots((prev) =>
        prev.map((slot) =>
          slot.id === slotId ? { ...slot, scheme_entry_id: schemeEntryId } : slot
        )
      );
      setMessage("Scheme link updated.");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to link scheme.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-4">
      <section className="rounded-2xl border border-slate-200 bg-white p-4">
        <h1 className="text-2xl font-bold text-slate-900">Timetable setup</h1>
        <p className="mt-1 text-sm text-slate-600">
          Configure your term structure, classes, reminders, and topic links.
        </p>
      </section>

      {loading ? (
        <section className="rounded-2xl border border-slate-200 bg-white p-4 text-sm text-slate-600">
          Loading setup...
        </section>
      ) : null}

      {message ? (
        <section className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700">
          {message}
        </section>
      ) : null}
      {error ? (
        <section className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">
          {error}
        </section>
      ) : null}

      <section className="rounded-2xl border border-slate-200 bg-white p-4">
        <div className="mb-3 flex gap-2 text-xs">
          {[1, 2, 3, 4].map((n) => (
            <button
              key={n}
              type="button"
              onClick={() => {
                router.replace(`/planning/timetable-setup?step=${n}`);
                setStep(n);
              }}
              className={[
                "rounded-full border px-3 py-1",
                step === n
                  ? "border-[#534AB7] bg-[#EEEDFE] text-[#3C3489]"
                  : "border-slate-200 bg-white text-slate-600",
              ].join(" ")}
            >
              Step {n}
            </button>
          ))}
        </div>

        {step === 1 ? (
          <div className="space-y-3">
            <h2 className="text-sm font-semibold text-slate-900">Step 1 · Term structure</h2>
            <div className="grid gap-3 md:grid-cols-3">
              <label className="text-xs text-slate-600">
                Weeks in term
                <input
                  type="number"
                  min={1}
                  max={20}
                  value={term.weeks_in_term}
                  onChange={(e) =>
                    setTerm((prev) => ({
                      ...prev,
                      weeks_in_term: Math.min(20, Math.max(1, Number(e.target.value || 1))),
                    }))
                  }
                  className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-900"
                />
              </label>
              <label className="text-xs text-slate-600">
                Term
                <select
                  value={term.term}
                  onChange={(e) =>
                    setTerm((prev) => ({
                      ...prev,
                      term: e.target.value as TermStructure["term"],
                    }))
                  }
                  className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-900"
                >
                  <option>First Term</option>
                  <option>Second Term</option>
                  <option>Third Term</option>
                </select>
              </label>
              <label className="text-xs text-slate-600">
                Academic year
                <input
                  value={term.academic_year}
                  onChange={(e) => setTerm((prev) => ({ ...prev, academic_year: e.target.value }))}
                  className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-900"
                  placeholder="2025/2026"
                />
              </label>
            </div>
            <button
              type="button"
              disabled={saving}
              onClick={() => void onSaveAndContinue(2)}
              className="rounded-xl bg-[#534AB7] px-4 py-2 text-sm font-semibold text-white hover:bg-[#3C3489] disabled:opacity-60"
            >
              Save and continue
            </button>
          </div>
        ) : null}

        {step === 2 ? (
          <div className="space-y-4">
            <h2 className="text-sm font-semibold text-slate-900">Step 2 · Daily timetable</h2>

            <div className="flex flex-wrap gap-2">
              {DAY_OPTIONS.map((day) => (
                <label
                  key={day}
                  className="inline-flex items-center gap-2 rounded-full border border-slate-200 px-3 py-1 text-xs text-slate-700"
                >
                  <input
                    type="checkbox"
                    checked={teachingDays.includes(day)}
                    onChange={(e) => {
                      setTeachingDays((prev) =>
                        e.target.checked
                          ? Array.from(new Set([...prev, day]))
                          : prev.filter((d) => d !== day)
                      );
                    }}
                  />
                  {day}
                </label>
              ))}
            </div>

            <div className="space-y-4">
              {teachingDays.map((day) => {
                const daySlots = activeSlots.filter((slot) => slot.day === day);
                return (
                  <div key={day} className="rounded-xl border border-slate-200 p-3">
                    <div className="mb-2 flex items-center justify-between">
                      <h3 className="text-sm font-medium text-slate-900">{day}</h3>
                      <button
                        type="button"
                        onClick={() => addSlot(day)}
                        className="text-xs font-medium text-[#534AB7] hover:underline"
                      >
                        Add another class
                      </button>
                    </div>
                    <div className="space-y-2">
                      {daySlots.map((slot) => (
                        <div key={slot.id} className="grid gap-2 md:grid-cols-6">
                          <input
                            value={slot.class_name}
                            onChange={(e) => updateSlot(slot.id, { class_name: e.target.value })}
                            placeholder="Class name"
                            className="rounded-lg border border-slate-200 px-2 py-1.5 text-xs"
                          />
                          <select
                            value={slot.subject}
                            onChange={(e) =>
                              updateSlot(slot.id, { subject: e.target.value as SubjectOption })
                            }
                            className="rounded-lg border border-slate-200 px-2 py-1.5 text-xs"
                          >
                            <option>Physics</option>
                            <option>Chemistry</option>
                            <option>Maths</option>
                            <option>Biology</option>
                            <option>English</option>
                            <option>Other</option>
                          </select>
                          <input
                            type="time"
                            value={slot.start_time}
                            onChange={(e) => updateSlot(slot.id, { start_time: e.target.value })}
                            className="rounded-lg border border-slate-200 px-2 py-1.5 text-xs"
                          />
                          <select
                            value={slot.duration_minutes}
                            onChange={(e) =>
                              updateSlot(slot.id, {
                                duration_minutes: Number(e.target.value) as 30 | 40 | 45 | 60,
                              })
                            }
                            className="rounded-lg border border-slate-200 px-2 py-1.5 text-xs"
                          >
                            <option value={30}>30</option>
                            <option value={40}>40</option>
                            <option value={45}>45</option>
                            <option value={60}>60</option>
                          </select>
                          <input
                            value={slot.room}
                            onChange={(e) => updateSlot(slot.id, { room: e.target.value })}
                            placeholder="Room (optional)"
                            className="rounded-lg border border-slate-200 px-2 py-1.5 text-xs"
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>

            <button
              type="button"
              disabled={saving}
              onClick={() => void onSaveAndContinue(3)}
              className="rounded-xl bg-[#534AB7] px-4 py-2 text-sm font-semibold text-white hover:bg-[#3C3489] disabled:opacity-60"
            >
              Save timetable
            </button>
          </div>
        ) : null}

        {step === 3 ? (
          <div className="space-y-4">
            <h2 className="text-sm font-semibold text-slate-900">
              Step 3 · Notification preferences
            </h2>

            <div className="grid gap-3 md:grid-cols-3">
              {[15, 30, 60, 1440].map((value) => (
                <label
                  key={value}
                  className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-xs text-slate-700"
                >
                  <input
                    type="radio"
                    checked={preferences.reminder_minutes === value}
                    onChange={() =>
                      setPreferences((prev) => ({ ...prev, reminder_minutes: value }))
                    }
                  />
                  {value === 1440 ? "Day before" : `${value} min`}
                </label>
              ))}
            </div>

            <div className="grid gap-3 md:grid-cols-3">
              {[
                ["in_app", "In-app only"],
                ["email", "Email only"],
                ["both", "Both"],
              ].map(([value, label]) => (
                <label
                  key={value}
                  className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-xs text-slate-700"
                >
                  <input
                    type="radio"
                    checked={preferences.delivery_method === value}
                    onChange={() =>
                      setPreferences((prev) => ({
                        ...prev,
                        delivery_method: value as Preferences["delivery_method"],
                      }))
                    }
                  />
                  {label}
                </label>
              ))}
            </div>

            <label className="inline-flex items-center gap-2 text-sm text-slate-700">
              <input
                type="checkbox"
                checked={preferences.enabled}
                onChange={(e) =>
                  setPreferences((prev) => ({ ...prev, enabled: e.target.checked }))
                }
              />
              Enable reminders
            </label>

            <button
              type="button"
              disabled={saving}
              onClick={() => void onSaveAndContinue(4)}
              className="rounded-xl bg-[#534AB7] px-4 py-2 text-sm font-semibold text-white hover:bg-[#3C3489] disabled:opacity-60"
            >
              Save preferences
            </button>
          </div>
        ) : null}

        {step === 4 ? (
          <div className="space-y-4">
            <h2 className="text-sm font-semibold text-slate-900">
              Step 4 · Link scheme of work topics
            </h2>
            <p className="text-xs text-slate-600">
              Match each timetable slot to a scheme entry of the same subject.
            </p>

            {savedSlots.length === 0 ? (
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs text-slate-600">
                Save timetable slots in step 2 first.
              </div>
            ) : (
              <div className="space-y-2">
                {savedSlots.map((slot) => {
                  const subjectKey = slot.subject.trim().toLowerCase();
                  const options = optionsBySubject.get(subjectKey) ?? schemeRows;
                  return (
                    <div
                      key={slot.id}
                      className="grid items-center gap-2 rounded-lg border border-slate-200 p-2 md:grid-cols-[1.6fr_1fr]"
                    >
                      <div className="text-xs text-slate-700">
                        <span className="font-medium">{slot.class_name}</span> · {slot.subject} ·{" "}
                        {isoToDay(slot.day_of_week)} {slot.start_time.slice(0, 5)}
                      </div>
                      <select
                        value={slot.scheme_entry_id ?? ""}
                        onChange={(e) =>
                          void linkScheme(slot.id, e.target.value || null)
                        }
                        className="rounded-lg border border-slate-200 px-2 py-1.5 text-xs"
                      >
                        <option value="">Select scheme topic</option>
                        {options.map((row) => (
                          <option key={row.id} value={row.id}>
                            Week {row.week_number} · {row.topic}
                          </option>
                        ))}
                      </select>
                    </div>
                  );
                })}
              </div>
            )}

            <button
              type="button"
              disabled={saving}
              onClick={() => router.push("/planning")}
              className="rounded-xl bg-[#534AB7] px-4 py-2 text-sm font-semibold text-white hover:bg-[#3C3489] disabled:opacity-60"
            >
              Done
            </button>
          </div>
        ) : null}
      </section>
    </div>
  );
}
