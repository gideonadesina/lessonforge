"use client";

import { useEffect, useMemo, useState } from "react";
import { createBrowserSupabase } from "@/lib/supabase/browser";
 

type LessonRow = {
  id: string;
  subject: string | null;
  topic: string | null;
  grade: string | null;
  curriculum: string | null;

  // ✅ FIX: your DB uses result_json (jsonb) not content
  result_json: any | null;

  // (optional) keep compatibility for any older code/rows you might still have
  content?: any | null;

  created_at: string;
};

type SortMode = "newest" | "oldest";

export default function LibraryPage() {
  const supabase = useMemo(() => createBrowserSupabase(), []);

  const [email, setEmail] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);

  const [lessons, setLessons] = useState<LessonRow[]>([]);
  const [error, setError] = useState<string | null>(null);

  const [q, setQ] = useState("");
  const [subjectFilter, setSubjectFilter] = useState<string>("all");
  const [gradeFilter, setGradeFilter] = useState<string>("all");
  const [sort, setSort] = useState<SortMode>("newest");

  const [active, setActive] = useState<LessonRow | null>(null);

  async function load() {
    setLoading(true);
    setError(null);

    try {
      const {
        data: { user },
        error: userErr,
      } = await supabase.auth.getUser();

      if (userErr || !user) throw new Error("Session expired. Please login again.");
      setEmail(user.email ?? "");

      // ✅ FIX: select result_json (and keep content as fallback if it exists in some env)
      const { data, error: fetchErr } = await supabase
        .from("lessons")
        .select("id, subject, topic, grade, curriculum, result_json, content, created_at")
        .order("created_at", { ascending: false });

      if (fetchErr) throw fetchErr;

      setLessons((data ?? []) as LessonRow[]);
    } catch (e: any) {
      setError(e?.message || "Failed to load library");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function LessonPreview({
  gen,
  fallbackSubject,
  fallbackTopic,
}: {
  gen: any;
  fallbackSubject: string;
  fallbackTopic: string;
}) {
  const meta = gen?.meta ?? {};
  const subject = meta?.subject ?? fallbackSubject;
  const topic = meta?.topic ?? fallbackTopic;

  const slides: any[] = Array.isArray(gen?.slides) ? gen.slides : [];
  const mcq: any[] = Array.isArray(gen?.quiz?.mcq) ? gen.quiz.mcq : [];
  const theory: any[] = Array.isArray(gen?.quiz?.theory) ? gen.quiz.theory : [];
  const objectives: string[] = Array.isArray(gen?.objectives) ? gen.objectives : [];
  const liveApps: string[] = Array.isArray(gen?.liveApplications) ? gen.liveApplications : [];

  return (
    <div className="space-y-6">
      {/* Meta header */}
      <div className="rounded-2xl border border-slate-200 bg-white p-4">
        <div className="text-xs text-slate-500">Lesson Pack</div>
        <div className="mt-1 text-xl font-extrabold text-slate-900">{topic || "Lesson"}</div>
        <div className="mt-1 text-sm text-slate-600">
          {subject ? <span className="font-semibold text-slate-800">{subject}</span> : null}
          {meta?.grade ? <span> • Grade {meta.grade}</span> : null}
          {meta?.curriculum ? <span> • {meta.curriculum}</span> : null}
          {meta?.durationMins ? <span> • {meta.durationMins} mins</span> : null}
        </div>
      </div>

      {/* Objectives */}
      {objectives.length ? (
        <section className="rounded-2xl border border-slate-200 bg-white p-4">
          <h3 className="text-sm font-bold text-slate-900">Objectives</h3>
          <ul className="mt-2 list-disc pl-6 space-y-1 text-sm text-slate-800">
            {objectives.map((o, i) => (
              <li key={i}>{o}</li>
            ))}
          </ul>
        </section>
      ) : null}

      {/* Lesson Notes */}
      {gen?.lessonNotes ? (
        <section className="rounded-2xl border border-slate-200 bg-white p-4">
          <h3 className="text-sm font-bold text-slate-900">Lesson Notes</h3>
          <div className="mt-2 whitespace-pre-wrap text-sm text-slate-800 leading-relaxed">
            {gen.lessonNotes}
          </div>
        </section>
      ) : null}

      {/* Slides */}
      {slides.length ? (
        <section className="space-y-4">
          <h3 className="text-sm font-bold text-slate-900">Slides</h3>

          <div className="grid gap-6">
            {slides.map((s, i) => {
              const title = s?.title || `Slide ${i + 1}`;
              const bullets: string[] = Array.isArray(s?.bullets) ? s.bullets : [];
              const videoQuery = s?.videoQuery || title || `${subject} ${topic}`;
              const activity = s?.interactivePrompt || "No interactive activity provided.";
              const img =
                s?.image ||
                "https://images.unsplash.com/photo-1524995997946-a1c2e315a42f?w=1200";

              return (
                <div
                  key={i}
                  className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm space-y-4"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="text-lg font-bold text-slate-900">
                      {i + 1}. {title}
                    </div>
                    <span className="text-[11px] font-semibold px-2 py-1 rounded-full border bg-slate-50 text-slate-700">
                      Slide {i + 1}
                    </span>
                  </div>

                  {/* Image */}
                  <div className="rounded-xl overflow-hidden border bg-slate-100">
                    <img
                      src={img}
                      alt={title}
                      className="w-full h-48 object-cover"
                      onError={(e) => {
                        e.currentTarget.src =
                          "https://images.unsplash.com/photo-1524995997946-a1c2e315a42f?w=1200";
                      }}
                    />
                  </div>

                  {/* Bullets */}
                  {bullets.length ? (
                    <ul className="list-disc pl-6 space-y-2 text-slate-800 font-medium">
                      {bullets.map((b, j) => (
                        <li key={j}>{b}</li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-sm text-slate-600">No bullet points.</p>
                  )}

                  {/* Video link */}
                  <div className="flex flex-wrap gap-4 text-sm">
                    <a
                      href={youtubeSearchUrl(videoQuery)}
                      target="_blank"
                      rel="noreferrer"
                      className="text-blue-600 font-semibold hover:underline"
                    >
                      🎥 Watch video
                    </a>
                  </div>

                  {/* Activity */}
                  <div className="rounded-xl border bg-yellow-50 p-3 text-sm text-slate-900">
                    <span className="font-bold">👩🏽‍🏫 Classroom Activity:</span> {activity}
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      ) : null}

      {/* MCQ */}
      {mcq.length ? (
        <section className="space-y-4">
          <h3 className="text-sm font-bold text-slate-900">📝 Multiple Choice Questions</h3>

          <div className="space-y-4">
            {mcq.map((q, i) => {
              const options: string[] = Array.isArray(q?.options) ? q.options : [];
              return (
                <div key={i} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                  <div className="font-semibold text-slate-900">
                    {i + 1}. {q?.q || q?.question || "Question"}
                  </div>

                  <div className="mt-3 space-y-2">
                    {options.slice(0, 4).map((opt, j) => (
                      <div key={j} className="flex items-start gap-3 text-sm text-slate-800">
                        <span className="font-bold text-violet-700 min-w-[22px]">
                          {String.fromCharCode(65 + j)}.
                        </span>
                        <span>{opt}</span>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      ) : null}

      {/* Theory */}
      {theory.length ? (
        <section className="space-y-4">
          <h3 className="text-sm font-bold text-slate-900">✍️ Theory Questions</h3>
          <div className="space-y-4">
            {theory.map((q, i) => (
              <div key={i} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                <div className="font-semibold text-slate-900">
                  {i + 1}. {q?.q || q?.question || "Question"}
                </div>

                {q?.markingGuide ? (
                  <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50 p-3">
                    <div className="text-xs font-semibold text-slate-700">Marking Guide</div>
                    <div className="mt-1 text-sm text-slate-700">{q.markingGuide}</div>
                  </div>
                ) : null}
              </div>
            ))}
          </div>
        </section>
      ) : null}

      {/* Real-life applications */}
      {liveApps.length ? (
        <section className="rounded-2xl border border-slate-200 bg-white p-4">
          <h3 className="text-sm font-bold text-slate-900">Real-life Applications</h3>
          <ul className="mt-2 list-disc pl-6 space-y-1 text-sm text-slate-800">
            {liveApps.map((x, i) => (
              <li key={i}>{x}</li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}

  const subjects = useMemo(() => {
    const set = new Set<string>();
    for (const l of lessons) if (l.subject) set.add(l.subject);
    return ["all", ...Array.from(set).sort((a, b) => a.localeCompare(b))];
  }, [lessons]);

  const grades = useMemo(() => {
    const set = new Set<string>();
    for (const l of lessons) if (l.grade) set.add(l.grade);
    return ["all", ...Array.from(set).sort((a, b) => a.localeCompare(b))];
  }, [lessons]);

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();

    let out = lessons.filter((l) => {
      const matchesText =
        !term ||
        (l.topic ?? "").toLowerCase().includes(term) ||
        (l.subject ?? "").toLowerCase().includes(term) ||
        (l.grade ?? "").toLowerCase().includes(term) ||
        (l.curriculum ?? "").toLowerCase().includes(term);

      const matchesSubject = subjectFilter === "all" || (l.subject ?? "") === subjectFilter;
      const matchesGrade = gradeFilter === "all" || (l.grade ?? "") === gradeFilter;

      return matchesText && matchesSubject && matchesGrade;
    });

    out = out.sort((a, b) => {
      const da = new Date(a.created_at).getTime();
      const db = new Date(b.created_at).getTime();
      return sort === "newest" ? db - da : da - db;
    });

    return out;
  }, [lessons, q, subjectFilter, gradeFilter, sort]);

  async function onDelete(id: string) {
    if (!confirm("Delete this lesson?")) return;

    setBusyId(id);
    try {
      const { error: delErr } = await supabase.from("lessons").delete().eq("id", id);
      if (delErr) throw delErr;

      setLessons((prev) => prev.filter((l) => l.id !== id));
      if (active?.id === id) setActive(null);
    } catch (e: any) {
      alert(e?.message || "Delete failed");
    } finally {
      setBusyId(null);
    }
  }

  // ✅ Helper: Always prefer result_json; fallback to content for older rows
  function getLessonPayload(row: LessonRow | null) {
    if (!row) return null;
    const raw = row.result_json ?? row.content ?? null;

    if (!raw) return null;

    // If it's accidentally stored as string JSON, parse it safely
    if (typeof raw === "string") {
      try {
        return JSON.parse(raw);
      } catch {
        return raw; // show as string
      }
    }

    return raw; // json object
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">My Lesson Library</h1>
          <p className="mt-1 text-sm text-slate-600">
            Search, reuse, and review your saved lessons.
          </p>
          {email ? (
            <div className="mt-1 text-xs text-slate-500">
              Signed in as <span className="font-semibold text-slate-700">{email}</span>
            </div>
          ) : null}
        </div>

        <button
          onClick={load}
          className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-800 hover:bg-slate-100 md:w-auto"
        >
          Refresh
        </button>
      </div>

      {/* Controls */}
      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
          <div className="md:col-span-2">
            <div className="mb-1 text-xs font-medium text-slate-600">
              Search by subject, topic, grade...
            </div>
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="e.g., Inflation, CRK, Grade 10..."
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-violet-400"
            />
          </div>

          <div>
            <div className="mb-1 text-xs font-medium text-slate-600">Subject</div>
            <select
              value={subjectFilter}
              onChange={(e) => setSubjectFilter(e.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-violet-400"
            >
              {subjects.map((s) => (
                <option key={s} value={s}>
                  {s === "all" ? "All subjects" : s}
                </option>
              ))}
            </select>
          </div>

          <div>
            <div className="mb-1 text-xs font-medium text-slate-600">Grade</div>
            <select
              value={gradeFilter}
              onChange={(e) => setGradeFilter(e.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-violet-400"
            >
              {grades.map((g) => (
                <option key={g} value={g}>
                  {g === "all" ? "All grades" : g}
                </option>
              ))}
            </select>
          </div>

          <div>
            <div className="mb-1 text-xs font-medium text-slate-600">Sort</div>
            <select
              value={sort}
              onChange={(e) => setSort(e.target.value as SortMode)}
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-violet-400"
            >
              <option value="newest">Newest first</option>
              <option value="oldest">Oldest first</option>
            </select>
          </div>

          <div className="md:col-span-3">
            <div className="rounded-xl bg-slate-50 p-3 text-xs text-slate-600">
              🔒 Your library is private to your account (RLS). Avoid student names or sensitive info.
            </div>
          </div>

          <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-white p-3 text-xs text-slate-700">
            <span>Total</span>
            <span className="font-semibold">{filtered.length}</span>
          </div>
        </div>
      </div>

      {/* Errors / Loading */}
      {error ? (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {error}
        </div>
      ) : null}

      {loading ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-6 text-sm text-slate-600">
          Loading your library...
        </div>
      ) : null}

      {/* Grid */}
      {!loading && filtered.length === 0 ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-6 text-sm text-slate-600">
          No lessons found. Generate one first.
        </div>
      ) : null}

      {!loading && filtered.length > 0 ? (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          {filtered.map((l) => (
            <div key={l.id} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="flex flex-wrap gap-2">
                    {l.subject ? (
                      <span className="rounded-full bg-violet-50 px-3 py-1 text-xs font-semibold text-violet-700">
                        {l.subject}
                      </span>
                    ) : null}
                    {l.grade ? (
                      <span className="rounded-full bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-700">
                        {l.grade}
                      </span>
                    ) : null}
                  </div>

                  <div className="mt-3 text-lg font-bold text-slate-900">
                    {l.topic || "Untitled lesson"}
                  </div>

                  <div className="mt-1 text-xs text-slate-500">{timeAgo(l.created_at)}</div>
                </div>

                <button
                  onClick={() => setActive(l)}
                  className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-800 hover:bg-slate-100"
                >
                  View
                </button>
              </div>

              <div className="mt-4 flex items-center justify-between">
                <button
                  onClick={() => setActive(l)}
                  className="rounded-xl bg-violet-600 px-3 py-2 text-xs font-semibold text-white shadow-sm hover:bg-violet-700"
                >
                  Open
                </button>

                <button
                  onClick={() => onDelete(l.id)}
                  disabled={busyId === l.id}
                  className="rounded-xl border border-red-200 bg-white px-3 py-2 text-xs font-semibold text-red-700 hover:bg-red-50 disabled:opacity-60"
                >
                  {busyId === l.id ? "Deleting..." : "Delete"}
                </button>
              </div>
            </div>
          ))}
        </div>
      ) : null}

      {/* Modal */}
      {active ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-3xl rounded-2xl border border-slate-200 bg-white shadow-xl">
            <div className="flex items-start justify-between gap-4 border-b border-slate-200 p-4">
              <div>
                <div className="text-lg font-bold text-slate-900">{active.topic || "Lesson"}</div>
                <div className="mt-1 text-xs text-slate-500">
                  {active.subject || "—"} • {active.grade || "—"} • {timeAgo(active.created_at)}
                </div>
              </div>

              <button
                onClick={() => setActive(null)}
                className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-800 hover:bg-slate-100"
              >
                Close
              </button>
            </div>

            <div className="max-h-[70vh] overflow-auto p-4">
            {(() => {
  const gen = getGeneratedFromRow(active);

  if (!gen) {
    return (
      <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
        This lesson has no saved content yet. It was likely created before auto-save was fixed.
        You can delete it and generate again.
      </div>
    );
  }

  return <LessonPreview gen={gen} fallbackSubject={active?.subject ?? ""} fallbackTopic={active?.topic ?? ""} />;
})()}


              {/* ✅ Small helpful message if the row is truly missing payload */}
              {!getLessonPayload(active) ? (
                <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
                  This lesson row has no saved content yet. It was likely created before auto-save was fixed.
                  You can delete it and generate again.
                </div>
              ) : null}
            </div>

            <div className="flex items-center justify-end gap-2 border-t border-slate-200 p-4">
              <button
                onClick={() => onDelete(active.id)}
                disabled={busyId === active.id}
                className="rounded-xl border border-red-200 bg-white px-3 py-2 text-xs font-semibold text-red-700 hover:bg-red-50 disabled:opacity-60"
              >
                {busyId === active.id ? "Deleting..." : "Delete"}
              </button>

              <button
                onClick={() => setActive(null)}
                className="rounded-xl bg-violet-600 px-3 py-2 text-xs font-semibold text-white shadow-sm hover:bg-violet-700"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
function youtubeSearchUrl(q: string) {
  return `https://www.youtube.com/results?search_query=${encodeURIComponent(q)}`;
}

function getGeneratedFromRow(row: LessonRow | null) {
  if (!row) return null;
  const raw = row.result_json ?? row.content ?? null;
  if (!raw) return null;

  if (typeof raw === "string") {
    try {
      return JSON.parse(raw);
    } catch {
      return null;
    }
  }
  return raw;
}

function safeStringify(v: any) {
  try {
    if (v === null || v === undefined) return ""; // ✅ never show "null"
    if (typeof v === "string") return v;
    return JSON.stringify(v, null, 2);
  } catch {
    return String(v ?? "");
  }
}

function timeAgo(iso: string) {
  const t = new Date(iso).getTime();
  const now = Date.now();
  const diff = Math.max(0, now - t);

  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins} min${mins === 1 ? "" : "s"} ago`;

  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs} hour${hrs === 1 ? "" : "s"} ago`;

  const days = Math.floor(hrs / 24);
  return `${days} day${days === 1 ? "" : "s"} ago`;
}
