"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { createBrowserSupabase } from "@/lib/supabase/browser";
import {
  createAcademicEvent,
  deleteAcademicEvent,
  listAcademicEvents,
  updateAcademicEvent,
} from "@/lib/planning/academicCalendar";
import { ACADEMIC_EVENT_TYPE_OPTIONS } from "@/lib/planning/constants";
import type {
  AcademicCalendarInput,
  AcademicCalendarRow,
  AcademicEventType,
} from "@/lib/planning/types";
import { formatEventDate } from "@/lib/planning/utils";
import EventTypeBadge from "@/components/planning/EventTypeBadge";
import { track } from "@/lib/analytics";

type AcademicCalendarFormState = {
  title: string;
  event_date: string;
  end_date: string;
  event_type: AcademicEventType;
  affected_classes: string[];
  affected_classes_text: string;
  description: string;
};

const DEFAULT_FORM: AcademicCalendarFormState = {
  title: "",
  event_date: "",
  end_date: "",
  event_type: "meeting",
  affected_classes: [],
  affected_classes_text: "",
  description: "",
};

function validateAcademicForm(form: AcademicCalendarFormState) {
  const errors: Partial<Record<keyof AcademicCalendarFormState, string>> = {};
  if (!form.title.trim()) errors.title = "Title is required.";
  if (!form.event_date.trim()) errors.event_date = "Event date is required.";
  if (!form.event_type) errors.event_type = "Event type is required.";
  if (
    form.end_date.trim() &&
    form.event_date.trim() &&
    form.end_date.trim() < form.event_date.trim()
  ) {
    errors.end_date = "End date must be on or after event date.";
  }
  return errors;
}

export default function AcademicCalendarClient({
  userId,
  initialRows,
  initialError,
}: {
  userId: string;
  initialRows: AcademicCalendarRow[];
  initialError?: string | null;
}) {
  const supabase = useMemo(() => createBrowserSupabase(), []);

  const [rows, setRows] = useState<AcademicCalendarRow[]>(initialRows);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<AcademicCalendarFormState>(DEFAULT_FORM);
  const [formErrors, setFormErrors] = useState<
    Partial<Record<keyof AcademicCalendarFormState, string>>
  >({});

  const [error, setError] = useState<string | null>(initialError ?? null);
  const [success, setSuccess] = useState<string | null>(null);
  const [knownClasses, setKnownClasses] = useState<string[]>([]);

  useEffect(() => {
    void (async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      const { data: timetable } = await supabase
        .from("teacher_timetable")
        .select("id")
        .eq("user_id", user.id)
        .order("updated_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (!timetable?.id) {
        setKnownClasses([]);
        return;
      }

      const { data: slots } = await supabase
        .from("timetable_slots")
        .select("class_name")
        .eq("timetable_id", timetable.id);

      const classes = Array.from(
        new Set((slots ?? []).map((slot) => slot.class_name?.trim()).filter(Boolean))
      ) as string[];
      setKnownClasses(classes);
    })();
  }, [supabase]);

  const loadEvents = useCallback(async () => {
    setLoading(true);
    setError(null);
    const { data, error: queryError } = await listAcademicEvents(supabase, userId);

    if (queryError) {
      setRows([]);
      setError(queryError.message);
    } else {
      setRows(data);
    }

    setLoading(false);
  }, [supabase, userId]);

  function resetForm() {
    setForm(DEFAULT_FORM);
    setFormErrors({});
    setEditingId(null);
  }

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    const nextErrors = validateAcademicForm(form);
    setFormErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    const payload: AcademicCalendarInput = {
      title: form.title,
      event_date: form.event_date,
      end_date: form.end_date || null,
      event_type: form.event_type,
      affected_classes:
        knownClasses.length > 0
          ? form.affected_classes
          : form.affected_classes_text
              .split(",")
              .map((item) => item.trim())
              .filter(Boolean),
      notification_sent: false,
      description: form.description || null,
    };

    setSaving(true);
    const result = editingId
      ? await updateAcademicEvent(supabase, userId, editingId, payload)
      : await createAcademicEvent(supabase, userId, payload);
    setSaving(false);

    if (result.error) {
      setError(result.error.message);
      return;
    }

    const today = new Date();
    const eventDate = new Date(`${form.event_date}T00:00:00Z`);
    const diffDays = Math.floor(
      (eventDate.getTime() - new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate())).getTime()) /
        86400000
    );

    if (diffDays >= 0 && diffDays <= 7) {
      await supabase.from("notifications").insert({
        user_id: userId,
        title: form.title.trim(),
        type: "info",
        read: false,
        notification_type: "INFO",
        message: form.title.trim(),
        sub_message: `Upcoming calendar event on ${form.event_date}`,
        action_label: "View calendar",
        action_url: "/planning/academic-calendar",
        timetable_slot_id: null,
        notification_date: form.event_date,
      });

      const latest = await supabase
        .from("academic_calendar")
        .select("id")
        .eq("user_id", userId)
        .eq("title", form.title.trim())
        .eq("event_date", form.event_date)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (latest.data?.id) {
        await supabase
          .from("academic_calendar")
          .update({ notification_sent: true })
          .eq("id", latest.data.id)
          .eq("user_id", userId);
      }
    }

    setSuccess(editingId ? "Academic event updated." : "Academic event added.");
    if (!editingId) {
      track("academic_event_created", {
        user_role: "teacher",
        active_role: "teacher",
        generation_type: "planning",
        event_type: payload.event_type,
      });
    }
    resetForm();
    await loadEvents();
  }

  async function onDelete(id: string) {
    if (!window.confirm("Delete this event?")) return;
    setSuccess(null);
    setError(null);
    setDeletingId(id);

    const result = await deleteAcademicEvent(supabase, userId, id);
    setDeletingId(null);

    if (result.error) {
      setError(result.error.message);
      return;
    }

    if (editingId === id) resetForm();
    setSuccess("Academic event deleted.");
    await loadEvents();
  }

  function onEdit(row: AcademicCalendarRow) {
    setEditingId(row.id);
    setForm({
      title: row.title,
      event_date: row.event_date,
      end_date: row.end_date ?? "",
      event_type: row.event_type,
      affected_classes: row.affected_classes ?? [],
      affected_classes_text: (row.affected_classes ?? []).join(", "),
      description: row.description ?? "",
    });
    setFormErrors({});
    setError(null);
    setSuccess(null);
  }

  return (
    <div className="space-y-5">
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Academic Calendar</h1>
            <p className="mt-1 text-sm text-slate-600">
              Track school events, exams, deadlines, and meetings.
            </p>
          </div>
          <Link
            href="/planning"
            className="inline-flex rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-800 hover:bg-slate-50"
          >
            Back to Planning
          </Link>
        </div>
      </div>

      <form
        onSubmit={onSubmit}
        className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
      >
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-sm font-bold text-slate-900">
            {editingId ? "Edit event" : "Add new event"}
          </h2>
          {editingId ? (
            <button
              type="button"
              onClick={resetForm}
              className="inline-flex rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
            >
              Cancel edit
            </button>
          ) : null}
        </div>

        <div className="mt-4 grid gap-3 md:grid-cols-2">
          <Field
            label="Title"
            value={form.title}
            onChange={(value) => setForm((prev) => ({ ...prev, title: value }))}
            placeholder="Mid-term examination"
            error={formErrors.title}
          />

          <Field
            label="Event date"
            value={form.event_date}
            onChange={(value) => setForm((prev) => ({ ...prev, event_date: value }))}
            error={formErrors.event_date}
            type="date"
          />

          <Field
            label="End date (optional)"
            value={form.end_date}
            onChange={(value) => setForm((prev) => ({ ...prev, end_date: value }))}
            error={formErrors.end_date}
            type="date"
          />

          <label className="text-xs text-slate-600">
            Event type
            <select
              value={form.event_type}
              onChange={(e) =>
                setForm((prev) => ({
                  ...prev,
                  event_type: e.target.value as AcademicEventType,
                }))
              }
              className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-violet-400"
            >
              {ACADEMIC_EVENT_TYPE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            {formErrors.event_type ? (
              <div className="mt-1 text-xs text-rose-700">{formErrors.event_type}</div>
            ) : null}
          </label>

          {knownClasses.length > 0 ? (
            <label className="text-xs text-slate-600">
              Affected classes
              <div className="mt-1 flex flex-wrap gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2">
                {knownClasses.map((className) => {
                  const checked = form.affected_classes.includes(className);
                  return (
                    <label
                      key={className}
                      className="inline-flex items-center gap-1 text-[11px] text-slate-700"
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={(e) => {
                          setForm((prev) => ({
                            ...prev,
                            affected_classes: e.target.checked
                              ? Array.from(new Set([...prev.affected_classes, className]))
                              : prev.affected_classes.filter((item) => item !== className),
                          }));
                        }}
                      />
                      {className}
                    </label>
                  );
                })}
              </div>
            </label>
          ) : (
            <label className="text-xs text-slate-600">
              Affected classes (comma separated)
              <input
                value={form.affected_classes_text}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, affected_classes_text: e.target.value }))
                }
                placeholder="JSS 1, JSS 2"
                className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-violet-400"
              />
            </label>
          )}

          <label className="text-xs text-slate-600">
            Description (optional)
            <textarea
              value={form.description}
              onChange={(e) =>
                setForm((prev) => ({ ...prev, description: e.target.value }))
              }
              placeholder="Short note about this event"
              rows={3}
              className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-violet-400"
            />
          </label>
        </div>

        <div className="mt-4">
          <button
            type="submit"
            disabled={saving}
            className="inline-flex rounded-xl bg-violet-600 px-4 py-2 text-sm font-semibold text-white hover:bg-violet-700 disabled:opacity-60"
          >
            {saving ? "Saving..." : editingId ? "Update event" : "Add event"}
          </button>
        </div>
      </form>

      {error ? (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
          {error}
        </div>
      ) : null}
      {success ? (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-700">
          {success}
        </div>
      ) : null}

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-bold text-slate-900">Upcoming and past events</h2>
          <button
            type="button"
            onClick={() => void loadEvents()}
            className="inline-flex rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
          >
            Refresh
          </button>
        </div>

        {loading ? (
          <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
            Loading calendar events...
          </div>
        ) : rows.length === 0 ? (
          <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
            No events yet. Add your first calendar event above.
          </div>
        ) : (
          <div className="mt-4 space-y-3">
            {rows.map((row) => (
              <article key={row.id} className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                  <div>
                    <div className="text-sm font-semibold text-slate-900">{row.title}</div>
                    <div className="mt-1 text-xs text-slate-600">
                      {formatEventDate(row.event_date)}
                      {row.end_date ? ` - ${formatEventDate(row.end_date)}` : ""}
                    </div>
                    {row.affected_classes?.length ? (
                      <div className="mt-1 text-[11px] text-slate-600">
                        Classes: {row.affected_classes.join(", ")}
                      </div>
                    ) : null}
                    {row.description ? (
                      <div className="mt-2 text-sm text-slate-600">{row.description}</div>
                    ) : null}
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <EventTypeBadge type={row.event_type} />
                    <button
                      type="button"
                      onClick={() => onEdit(row)}
                      className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100"
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      onClick={() => void onDelete(row.id)}
                      disabled={deletingId === row.id}
                      className="rounded-lg border border-rose-200 bg-white px-3 py-1.5 text-xs font-semibold text-rose-700 hover:bg-rose-50 disabled:opacity-60"
                    >
                      {deletingId === row.id ? "Deleting..." : "Delete"}
                    </button>
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
  error,
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  error?: string;
  type?: "text" | "date";
}) {
  return (
    <label className="text-xs text-slate-600">
      {label}
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-violet-400"
      />
      {error ? <div className="mt-1 text-xs text-rose-700">{error}</div> : null}
    </label>
  );
}
