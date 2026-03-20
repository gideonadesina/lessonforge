"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

type ExamType = "waec" | "neco";

type ExamRow = {
  id: string;
  title: string;
  subject: string;
  grade: string | null;
  exam_type: ExamType;
  duration_mins: number;
  total_questions: number;
  created_at: string;
  updated_at?: string;
};

function clsx(...x: Array<string | false | null | undefined>) {
  return x.filter(Boolean).join(" ");
}

async function getJson<T>(url: string): Promise<{ ok: boolean; status: number; data: T }> {
  const res = await fetch(url, { method: "GET" });
  const data = (await res.json()) as T;
  return { ok: res.ok, status: res.status, data };
}

async function postJson<T>(url: string, body: any): Promise<{ ok: boolean; status: number; data: T }> {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = (await res.json()) as T;
  return { ok: res.ok, status: res.status, data };
}

const SUBJECTS = [
  "All",
  "English Language",
  "Mathematics",
  "Further Mathematics",
  "Biology",
  "Chemistry",
  "Physics",
  "Agricultural Science",
  "Economics",
  "Commerce",
  "Financial Accounting",
  "Government",
  "Civic Education",
  "Geography",
  "Literature-in-English",
  "Christian Religious Studies (CRS)",
  "Islamic Religious Studies (IRS)",
  "History",
  "Data Processing",
  "Computer Studies/ICT",
  "Marketing",
  "Business Studies",
] as const;

export default function ExamPrepHome() {
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  const [rows, setRows] = useState<ExamRow[]>([]);

  // create modal-lite (inline)
  const [creating, setCreating] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newSubject, setNewSubject] = useState<string>("English Language");
  const [newGrade, setNewGrade] = useState("SS3");
  const [newExamType, setNewExamType] = useState<ExamType>("waec");
  const [newDuration, setNewDuration] = useState<number>(90);

  // filters
  const [q, setQ] = useState("");
  const [subjectFilter, setSubjectFilter] = useState<string>("All");
  const [typeFilter, setTypeFilter] = useState<"all" | ExamType>("all");

  async function load() {
    setMsg(null);
    setLoading(true);

    const res = await getJson<{ items: ExamRow[] }>("/api/exam-prep/list");
    setLoading(false);

    if (!res.ok) {
      setMsg((res.data as any)?.error ?? `Failed to load (${res.status})`);
      return;
    }

    setRows(res.data.items ?? []);
  }

  useEffect(() => {
    load();
  }, []);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return (rows ?? []).filter((r) => {
      const matchesQ =
        !needle ||
        String(r.title ?? "").toLowerCase().includes(needle) ||
        String(r.subject ?? "").toLowerCase().includes(needle) ||
        String(r.grade ?? "").toLowerCase().includes(needle);

      const matchesSubject = subjectFilter === "All" || r.subject === subjectFilter;
      const matchesType = typeFilter === "all" || r.exam_type === typeFilter;

      return matchesQ && matchesSubject && matchesType;
    });
  }, [rows, q, subjectFilter, typeFilter]);

  async function createExam() {
    setMsg(null);

    const title = newTitle.trim();
    if (!title) {
      setMsg("Please enter a title for the exam.");
      return;
    }

    setCreating(true);
    const res = await postJson<any>("/api/exam-prep/create", {
      title,
      subject: newSubject,
      grade: newGrade,
      exam_type: newExamType,
      duration_mins: newDuration,
    });
    setCreating(false);

    if (!res.ok) {
      setMsg(res.data?.error ?? `Create failed (${res.status})`);
      return;
    }

    const id = res.data?.id;
    if (!id) {
      setMsg("Created but no id returned. Check your create endpoint.");
      return;
    }

    // redirect to editor
    window.location.href = `/exam-prep/${id}`;
  }

  async function duplicateExam(id: string) {
    setMsg(null);
    setBusyId(id);

    const res = await postJson<any>("/api/exam-prep/duplicate", { id });
    setBusyId(null);

    if (!res.ok) {
      setMsg(res.data?.error ?? "Duplicate endpoint not implemented yet.");
      return;
    }

    const newId = res.data?.id;
    if (newId) window.location.href = `/exam-prep/${newId}`;
  }

  async function copyLink(id: string) {
    const url = `${window.location.origin}/exam-prep/${id}`;
    try {
      await navigator.clipboard.writeText(url);
      setMsg("Link copied ✅");
    } catch {
      setMsg("Could not copy link. Your browser blocked clipboard.");
    }
  }

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <header className="sticky top-0 z-10 border-b border-slate-200 bg-white/85 backdrop-blur">
        <div className="mx-auto w-full max-w-7xl px-6 py-4 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-2xl bg-gradient-to-br from-indigo-600 to-violet-600 shadow-sm" />
            <div className="leading-tight">
              <div className="text-sm font-semibold text-slate-900">LessonForge • Exam Builder</div>
              <div className="text-xs text-slate-500">Create, save, copy, print, reuse.</div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Link
              href="/dashboard"
              className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-800 hover:bg-slate-50"
            >
              Dashboard
            </Link>

            <button
              type="button"
              onClick={() => {
                setNewTitle(`Practice Test - ${new Date().toLocaleDateString()}`);
                setMsg(null);
                // scroll to creator
                document.getElementById("create-card")?.scrollIntoView({ behavior: "smooth", block: "start" });
              }}
              className="rounded-xl bg-slate-900 text-white px-4 py-2 text-sm font-semibold hover:bg-slate-800"
            >
              + New exam
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-7xl px-6 py-8 grid grid-cols-1 xl:grid-cols-[420px_1fr] gap-8 items-start">
        {/* LEFT: Create + Tips */}
        <section id="create-card" className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm xl:sticky xl:top-24">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="text-sm font-semibold text-slate-900">Create a new exam</div>
              <div className="mt-1 text-xs text-slate-500">
                Teacher-first: you can add questions manually, bulk paste, then print.
              </div>
            </div>
            <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-700">
              Low token mode ✅
            </span>
          </div>

          {msg && (
            <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
              {msg}
            </div>
          )}

          <div className="mt-5 grid gap-4">
            <div>
              <label className="text-sm font-medium text-slate-700">Title</label>
              <input
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                className="mt-1 w-full rounded-2xl border border-slate-200 px-3 py-3"
                placeholder="e.g., SS3 Mathematics Revision Test"
              />
            </div>

            <div>
              <label className="text-sm font-medium text-slate-700">Subject</label>
              <select
                value={newSubject}
                onChange={(e) => setNewSubject(e.target.value)}
                className="mt-1 w-full rounded-2xl border border-slate-200 px-3 py-3 bg-white"
              >
                {SUBJECTS.filter((s) => s !== "All").map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-sm font-medium text-slate-700">Class / Level</label>
                <input
                  value={newGrade}
                  onChange={(e) => setNewGrade(e.target.value)}
                  className="mt-1 w-full rounded-2xl border border-slate-200 px-3 py-3"
                  placeholder="SS3"
                />
              </div>

              <div>
                <label className="text-sm font-medium text-slate-700">Duration</label>
                <input
                  type="number"
                  min={10}
                  max={180}
                  value={newDuration}
                  onChange={(e) => setNewDuration(Number(e.target.value))}
                  className="mt-1 w-full rounded-2xl border border-slate-200 px-3 py-3"
                />
              </div>
            </div>

            <div>
              <label className="text-sm font-medium text-slate-700">Exam type (format)</label>
              <div className="mt-2 flex gap-2">
                {(["waec", "neco"] as const).map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setNewExamType(t)}
                    className={clsx(
                      "flex-1 rounded-2xl px-3 py-3 text-sm font-semibold border transition",
                      newExamType === t
                        ? "bg-slate-900 text-white border-slate-900"
                        : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50"
                    )}
                  >
                    {t.toUpperCase()}
                  </button>
                ))}
              </div>
              <div className="mt-1 text-xs text-slate-500">
                This controls headings + formatting. Your questions can still be custom.
              </div>
            </div>

            <button
              type="button"
              onClick={createExam}
              disabled={creating}
              className="rounded-2xl bg-indigo-600 text-white px-5 py-3 text-sm font-semibold hover:bg-indigo-700 disabled:opacity-60"
            >
              {creating ? "Creating…" : "Create & open editor →"}
            </button>
          </div>

          {/* Tips */}
          <div className="mt-6 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-xs text-slate-600 leading-relaxed">
            <div className="font-semibold text-slate-900">Teacher workflow</div>
            <ul className="list-disc pl-5 mt-2 space-y-1">
              <li>Create exam (meta only)</li>
              <li>Add questions manually or bulk paste</li>
              <li>Toggle Teacher Mode to show answers/marking guide</li>
              <li>Print clean paper for your class</li>
            </ul>
          </div>
        </section>

        {/* RIGHT: Saved Exams */}
        <section className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="text-xl font-bold text-slate-900">Saved exams</h2>
              <p className="mt-1 text-sm text-slate-600">
                Open, copy, print, duplicate — your exams are private to your account.
              </p>
            </div>

            <button
              onClick={load}
              className="rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold hover:bg-slate-50"
            >
              Refresh
            </button>
          </div>

          {/* Filters */}
          <div className="mt-4 grid gap-3">
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search title, subject, class…"
              className="w-full rounded-2xl border border-slate-200 px-4 py-3"
            />

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <select
                value={subjectFilter}
                onChange={(e) => setSubjectFilter(e.target.value)}
                className="w-full rounded-2xl border border-slate-200 px-4 py-3 bg-white"
              >
                {SUBJECTS.map((s) => (
                  <option key={s} value={s}>
                    {s === "All" ? "All subjects" : s}
                  </option>
                ))}
              </select>

              <select
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value as any)}
                className="w-full rounded-2xl border border-slate-200 px-4 py-3 bg-white"
              >
                <option value="all">All types</option>
                <option value="waec">WAEC</option>
                <option value="neco">NECO</option>
              </select>

              <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-700">
                {filtered.length} item(s)
              </div>
            </div>
          </div>

          <div className="mt-5 space-y-3">
            {loading ? (
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-6 text-sm text-slate-600">
                Loading your saved exams…
              </div>
            ) : filtered.length === 0 ? (
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-6 text-sm text-slate-600">
                <div className="font-semibold text-slate-900">No saved exams yet</div>
                <div className="mt-1">Create a new exam on the left to get started.</div>
              </div>
            ) : (
              filtered.map((x) => (
                <div key={x.id} className="rounded-[1.5rem] border border-slate-200 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="truncate font-semibold text-slate-900">{x.title}</div>
                      <div className="text-sm text-slate-600 mt-1">
                        {String(x.exam_type).toUpperCase()} • {x.subject} • {x.grade ?? "—"} •{" "}
                        {x.total_questions}Q • {x.duration_mins} mins
                      </div>
                      <div className="text-xs text-slate-500 mt-1">
                        Created: {new Date(x.created_at).toLocaleString()}
                      </div>
                    </div>

                    <Link
                      href={`/exam-prep/${x.id}`}
                      className="shrink-0 rounded-xl bg-slate-900 text-white px-4 py-2 text-sm font-semibold hover:bg-slate-800"
                    >
                      Open →
                    </Link>
                  </div>

                  <div className="mt-3 flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => copyLink(x.id)}
                      className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold hover:bg-slate-50"
                    >
                      Copy link
                    </button>

                    <Link
                      href={`/exam-prep/${x.id}#${"lessonforge-exam-paper"}`}
                      className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold hover:bg-slate-50"
                    >
                      Print (open)
                    </Link>

                    <button
                      type="button"
                      onClick={() => duplicateExam(x.id)}
                      disabled={busyId === x.id}
                      className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold hover:bg-slate-50 disabled:opacity-60"
                    >
                      {busyId === x.id ? "Duplicating…" : "Duplicate"}
                    </button>

                    <button
                      type="button"
                      onClick={() => setMsg("Export coming next. We’ll export to PDF/Docx cleanly.")}
                      className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold hover:bg-slate-50"
                    >
                      Export
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>

          <div className="mt-6 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-xs text-slate-600 leading-relaxed">
            <div className="font-semibold text-slate-900">Why this scales (low token)</div>
            You mostly <b>save + reuse</b>. Bulk paste imports your existing questions. AI can be optional and used in small
            batches only when you truly need new questions.
          </div>
        </section>
      </main>
    </div>
  );
}