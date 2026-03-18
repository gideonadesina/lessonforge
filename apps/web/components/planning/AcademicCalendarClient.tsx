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

type AcademicCalendarFormState = {
  title: string;
  event_date: string;
  event_type: AcademicEventType;
  description: string;
};

const DEFAULT_FORM: AcademicCalendarFormState = {
  title: "",
  event_date: "",
  event_type: "meeting",
  description: "",
};

function validateAcademicForm(form: AcademicCalendarFormState) {
  const errors: Partial<Record<keyof AcademicCalendarFormState, string>> = {};
  if (!form.title.trim()) errors.title = "Title is required.";
  if (!form.event_date.trim()) errors.event_date = "Event date is required.";
  if (!form.event_type) errors.event_type = "Event type is required.";
  return errors;
}

export default function AcademicCalendarClient({ userId }: { userId: string }) {
  const supabase = useMemo(() => createBrowserSupabase(), []);

  const [rows, setRows] = useState<AcademicCalendarRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<AcademicCalendarFormState>(DEFAULT_FORM);
  const [formErrors, setFormErrors] = useState<
    Partial<Record<keyof AcademicCalendarFormState, string>>
  >({});

  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

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

  useEffect(() => {
    void loadEvents();
  }, [loadEvents]);

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
      event_type: form.event_type,
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

    setSuccess(editingId ? "Academic event updated." : "Academic event added.");
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
      event_type: row.event_type,
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
                    </div>
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
