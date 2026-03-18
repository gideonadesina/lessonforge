"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { createBrowserSupabase } from "@/lib/supabase/browser";
import {
  createSchemeEntry,
  deleteSchemeEntry,
  listSchemeOfWork,
  updateSchemeEntry,
} from "@/lib/planning/scheme";
import { SCHEME_STATUS_OPTIONS } from "@/lib/planning/constants";
import type {
  SchemeOfWorkFilters,
  SchemeOfWorkInput,
  SchemeOfWorkRow,
  SchemeStatus,
} from "@/lib/planning/types";
import SchemeStatusBadge from "@/components/planning/SchemeStatusBadge";

type SchemeFormState = {
  class_name: string;
  subject: string;
  term: string;
  week_number: string;
  topic: string;
  subtopic: string;
  status: SchemeStatus;
};

const DEFAULT_FORM: SchemeFormState = {
  class_name: "",
  subject: "",
  term: "",
  week_number: "",
  topic: "",
  subtopic: "",
  status: "not_started",
};

const EMPTY_FILTERS: SchemeOfWorkFilters = {
  class_name: "",
  subject: "",
  term: "",
};

function validateSchemeForm(form: SchemeFormState) {
  const errors: Partial<Record<keyof SchemeFormState, string>> = {};
  if (!form.class_name.trim()) errors.class_name = "Class name is required.";
  if (!form.subject.trim()) errors.subject = "Subject is required.";
  if (!form.term.trim()) errors.term = "Term is required.";
  if (!form.topic.trim()) errors.topic = "Topic is required.";

  const week = Number(form.week_number);
  if (!form.week_number.trim()) {
    errors.week_number = "Week number is required.";
  } else if (!Number.isInteger(week) || week <= 0 || week > 53) {
    errors.week_number = "Week number must be between 1 and 53.";
  }

  return errors;
}

export default function SchemeOfWorkClient({ userId }: { userId: string }) {
  const supabase = useMemo(() => createBrowserSupabase(), []);

  const [draftFilters, setDraftFilters] =
    useState<SchemeOfWorkFilters>(EMPTY_FILTERS);
  const [filters, setFilters] = useState<SchemeOfWorkFilters>(EMPTY_FILTERS);

  const [rows, setRows] = useState<SchemeOfWorkRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<SchemeFormState>(DEFAULT_FORM);
  const [formErrors, setFormErrors] = useState<
    Partial<Record<keyof SchemeFormState, string>>
  >({});

  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const loadEntries = useCallback(async () => {
    setLoading(true);
    setError(null);

    const normalizedFilters: SchemeOfWorkFilters = {
      class_name: filters.class_name?.trim() || undefined,
      subject: filters.subject?.trim() || undefined,
      term: filters.term?.trim() || undefined,
    };

    const { data, error: queryError } = await listSchemeOfWork(
      supabase,
      userId,
      normalizedFilters
    );

    if (queryError) {
      setRows([]);
      setError(queryError.message);
    } else {
      setRows(data);
    }

    setLoading(false);
  }, [filters.class_name, filters.subject, filters.term, supabase, userId]);

  useEffect(() => {
    void loadEntries();
  }, [loadEntries]);

  const groupedByWeek = useMemo(() => {
    const groups = new Map<number, SchemeOfWorkRow[]>();
    for (const row of rows) {
      if (!groups.has(row.week_number)) groups.set(row.week_number, []);
      groups.get(row.week_number)?.push(row);
    }
    return Array.from(groups.entries()).sort((a, b) => a[0] - b[0]);
  }, [rows]);

  const filterCount = [
    filters.class_name?.trim(),
    filters.subject?.trim(),
    filters.term?.trim(),
  ].filter(Boolean).length;

  function resetForm() {
    setForm(DEFAULT_FORM);
    setFormErrors({});
    setEditingId(null);
  }

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSuccess(null);
    setError(null);

    const nextErrors = validateSchemeForm(form);
    setFormErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    const payload: SchemeOfWorkInput = {
      class_name: form.class_name,
      subject: form.subject,
      term: form.term,
      week_number: Number(form.week_number),
      topic: form.topic,
      subtopic: form.subtopic || null,
      status: form.status,
    };

    setSaving(true);
    const result = editingId
      ? await updateSchemeEntry(supabase, userId, editingId, payload)
      : await createSchemeEntry(supabase, userId, payload);

    setSaving(false);

    if (result.error) {
      setError(result.error.message);
      return;
    }

    setSuccess(editingId ? "Scheme entry updated." : "Scheme entry added.");
    resetForm();
    await loadEntries();
  }

  async function onDelete(id: string) {
    if (!window.confirm("Delete this scheme entry?")) return;
    setSuccess(null);
    setError(null);
    setDeletingId(id);

    const result = await deleteSchemeEntry(supabase, userId, id);
    setDeletingId(null);

    if (result.error) {
      setError(result.error.message);
      return;
    }

    if (editingId === id) resetForm();
    setSuccess("Scheme entry deleted.");
    await loadEntries();
  }

  function onEdit(row: SchemeOfWorkRow) {
    setEditingId(row.id);
    setForm({
      class_name: row.class_name,
      subject: row.subject,
      term: row.term,
      week_number: String(row.week_number),
      topic: row.topic,
      subtopic: row.subtopic ?? "",
      status: row.status,
    });
    setFormErrors({});
    setSuccess(null);
    setError(null);
  }

  function onFilterSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setFilters({
      class_name: draftFilters.class_name ?? "",
      subject: draftFilters.subject ?? "",
      term: draftFilters.term ?? "",
    });
  }

  function onClearFilters() {
    setDraftFilters(EMPTY_FILTERS);
    setFilters(EMPTY_FILTERS);
  }

  return (
    <div className="space-y-5">
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Scheme of Work</h1>
            <p className="mt-1 text-sm text-slate-600">
              Plan weekly topics by class, subject, and term.
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
        onSubmit={onFilterSubmit}
        className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
      >
        <div className="flex items-center justify-between gap-4">
          <h2 className="text-sm font-bold text-slate-900">Filter entries</h2>
          <span className="text-xs text-slate-600">
            Active filters: <b>{filterCount}</b>
          </span>
        </div>

        <div className="mt-4 grid gap-3 md:grid-cols-4">
          <label className="text-xs text-slate-600">
            Class
            <input
              value={draftFilters.class_name ?? ""}
              onChange={(e) =>
                setDraftFilters((prev) => ({ ...prev, class_name: e.target.value }))
              }
              placeholder="e.g. JSS 2"
              className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-violet-400"
            />
          </label>

          <label className="text-xs text-slate-600">
            Subject
            <input
              value={draftFilters.subject ?? ""}
              onChange={(e) =>
                setDraftFilters((prev) => ({ ...prev, subject: e.target.value }))
              }
              placeholder="e.g. Mathematics"
              className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-violet-400"
            />
          </label>

          <label className="text-xs text-slate-600">
            Term
            <input
              value={draftFilters.term ?? ""}
              onChange={(e) =>
                setDraftFilters((prev) => ({ ...prev, term: e.target.value }))
              }
              placeholder="e.g. First Term"
              className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-violet-400"
            />
          </label>

          <div className="flex items-end gap-2">
            <button
              type="submit"
              className="inline-flex rounded-xl bg-violet-600 px-4 py-2 text-sm font-semibold text-white hover:bg-violet-700"
            >
              Apply
            </button>
            <button
              type="button"
              onClick={onClearFilters}
              className="inline-flex rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-800 hover:bg-slate-50"
            >
              Clear
            </button>
          </div>
        </div>
      </form>

      <form
        onSubmit={onSubmit}
        className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
      >
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-sm font-bold text-slate-900">
            {editingId ? "Edit entry" : "Add new entry"}
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

        <div className="mt-4 grid gap-3 md:grid-cols-2 lg:grid-cols-3">
          <Field
            label="Class name"
            value={form.class_name}
            onChange={(value) => setForm((prev) => ({ ...prev, class_name: value }))}
            error={formErrors.class_name}
            placeholder="JSS 2"
          />
          <Field
            label="Subject"
            value={form.subject}
            onChange={(value) => setForm((prev) => ({ ...prev, subject: value }))}
            error={formErrors.subject}
            placeholder="Mathematics"
          />
          <Field
            label="Term"
            value={form.term}
            onChange={(value) => setForm((prev) => ({ ...prev, term: value }))}
            error={formErrors.term}
            placeholder="First Term"
          />

          <Field
            label="Week number"
            value={form.week_number}
            onChange={(value) => setForm((prev) => ({ ...prev, week_number: value }))}
            error={formErrors.week_number}
            placeholder="1"
            type="number"
            min={1}
            max={53}
          />

          <Field
            label="Topic"
            value={form.topic}
            onChange={(value) => setForm((prev) => ({ ...prev, topic: value }))}
            error={formErrors.topic}
            placeholder="Fractions"
          />

          <Field
            label="Subtopic (optional)"
            value={form.subtopic}
            onChange={(value) => setForm((prev) => ({ ...prev, subtopic: value }))}
            error={formErrors.subtopic}
            placeholder="Adding unlike fractions"
          />

          <label className="text-xs text-slate-600">
            Status
            <select
              value={form.status}
              onChange={(e) =>
                setForm((prev) => ({
                  ...prev,
                  status: e.target.value as SchemeStatus,
                }))
              }
              className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-violet-400"
            >
              {SCHEME_STATUS_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="mt-4">
          <button
            type="submit"
            disabled={saving}
            className="inline-flex rounded-xl bg-violet-600 px-4 py-2 text-sm font-semibold text-white hover:bg-violet-700 disabled:opacity-60"
          >
            {saving ? "Saving..." : editingId ? "Update entry" : "Add entry"}
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
          <h2 className="text-sm font-bold text-slate-900">Entries by week</h2>
          <button
            type="button"
            onClick={() => void loadEntries()}
            className="inline-flex rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
          >
            Refresh
          </button>
        </div>

        {loading ? (
          <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
            Loading scheme entries...
          </div>
        ) : groupedByWeek.length === 0 ? (
          <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
            No entries yet. Add your first week topic above.
          </div>
        ) : (
          <div className="mt-4 space-y-4">
            {groupedByWeek.map(([weekNumber, weekRows]) => (
              <div key={weekNumber} className="rounded-xl border border-slate-200 p-4">
                <div className="mb-3 text-sm font-semibold text-slate-900">
                  Week {weekNumber}
                </div>
                <div className="space-y-3">
                  {weekRows.map((row) => (
                    <article
                      key={row.id}
                      className="rounded-xl border border-slate-200 bg-slate-50 p-4"
                    >
                      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                        <div>
                          <div className="text-sm font-semibold text-slate-900">
                            {row.topic}
                          </div>
                          {row.subtopic ? (
                            <div className="mt-1 text-sm text-slate-600">
                              {row.subtopic}
                            </div>
                          ) : null}
                          <div className="mt-2 text-xs text-slate-600">
                            {row.class_name} • {row.subject} • {row.term}
                          </div>
                        </div>

                        <div className="flex flex-wrap items-center gap-2">
                          <SchemeStatusBadge status={row.status} />
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
              </div>
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
  error,
  placeholder,
  type = "text",
  min,
  max,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  error?: string;
  placeholder?: string;
  type?: "text" | "number";
  min?: number;
  max?: number;
}) {
  return (
    <label className="text-xs text-slate-600">
      {label}
      <input
        type={type}
        min={min}
        max={max}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-violet-400"
      />
      {error ? <div className="mt-1 text-xs text-rose-700">{error}</div> : null}
    </label>
  );
}
