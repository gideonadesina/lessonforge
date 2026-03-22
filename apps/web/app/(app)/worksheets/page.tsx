"use client";

import { useEffect, useMemo, useState } from "react";
import { createBrowserSupabase } from "@/lib/supabase/browser";

type WorksheetRow = {
  id: string;
  subject: string;
  topic: string;
  grade: string;
  worksheet_type: string | null;
  difficulty: string | null;
  num_questions: number | null;
  duration_mins: number | null;
  created_at: string;
};

type ContentMode = "normal" | "diagram" | "coloring" | "practical";

type WorksheetVisual = {
  label: string;
  imageDataUrl: string;
};

type GeneratedPayload = {
  title?: string;
  instructions?: string[];
  worksheet?: string;
  answerKey?: string;
  visuals?: WorksheetVisual[];
  contentMode?: ContentMode;
};

type PrintMode = "student" | "teacher";

function getErrorMessage(error: unknown, fallback: string) {
  if (error && typeof error === "object" && "message" in error) {
    return String((error as { message?: unknown }).message ?? fallback);
  }
  return fallback;
}

export default function WorksheetsPage() {
  const [subject, setSubject] = useState("Basic Science");
  const [grade, setGrade] = useState("Grade 4");
  const [topic, setTopic] = useState("Alimentary Canal");
  const [worksheetType, setWorksheetType] = useState("Mixed");
  const [difficulty, setDifficulty] = useState("Medium");
  const [contentMode, setContentMode] = useState<ContentMode>("normal");
  const [numQuestions, setNumQuestions] = useState(10);
  const [durationMins, setDurationMins] = useState(30);

  const [loading, setLoading] = useState(false);
  const [listLoading, setListLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [items, setItems] = useState<WorksheetRow[]>([]);
  const [query, setQuery] = useState("");

  const [open, setOpen] = useState(false);
  const [active, setActive] = useState<{
    meta?: WorksheetRow;
    generated?: GeneratedPayload;
  } | null>(null);

  // ✅ Print mode: Student prints worksheet only; Teacher prints worksheet + answer key
  const [printMode, setPrintMode] = useState<PrintMode>("student");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return items;
    return items.filter((x) => {
      return (
        x.subject.toLowerCase().includes(q) ||
        x.topic.toLowerCase().includes(q) ||
        x.grade.toLowerCase().includes(q)
      );
    });
  }, [items, query]);

  async function getAccessToken() {
    const supabase = createBrowserSupabase();
    const { data } = await supabase.auth.getSession();
    return data.session?.access_token ?? "";
  }

  // --- Helpers to normalize API responses (so your UI never breaks) ---
  function normalizeListResponse(json: unknown): WorksheetRow[] {
    const obj = (json ?? {}) as { data?: unknown };
    const dataObj = (obj.data ?? {}) as { data?: unknown };
    // Your route returns: { ok:true, data:[...] }
    // Some older routes returned: { data:[...] } or { ok:true, data:{data:[...]} }
    const list =
      (Array.isArray(obj.data) ? obj.data : null) ??
      (Array.isArray(dataObj.data) ? dataObj.data : null) ??
      (Array.isArray(json) ? json : null) ??
      [];
    return list as WorksheetRow[];
  }

  function normalizeFullResponse(json: unknown): { meta?: WorksheetRow; generated?: GeneratedPayload } {
    const root = (json ?? {}) as Record<string, unknown>;
    // Your route GET?id returns: { ok:true, data:{ saved, generated } }
    const payload = (root.data ?? root) as Record<string, unknown>;
    const payloadData = (payload.data ?? {}) as Record<string, unknown>;
    const payloadResultJson = (payload.result_json ?? null) as Record<string, unknown> | null;
    const resultWorksheet = (payloadResultJson?.worksheet ?? null) as Record<string, unknown> | null;
    const saved =
      payload.saved ??
      payloadData.saved ??
      payloadData.data ??
      payload.row ??
      payload.data ??
      null;
    const generated =
      payload.generated ??
      payloadData.generated ??
      (payloadResultJson
        ? {
            title: resultWorksheet?.title,
            instructions: resultWorksheet?.instructions as string[] | undefined,
            worksheet: stringifyWorksheetFromJson(payloadResultJson),
            answerKey: stringifyAnswerKeyFromJson(payloadResultJson),
          }
        : null);

    return {
      meta: saved ?? undefined,
      generated: generated ?? undefined,
    };
  }

  async function loadList() {
    setListLoading(true);
    setError(null);
    try {
      const token = await getAccessToken();
      if (!token) throw new Error("Not logged in");

      const res = await fetch("/api/worksheets", {
        method: "GET",
        headers: { Authorization: `Bearer ${token}` },
      });

      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error || "Failed to load worksheets");

      setItems(normalizeListResponse(json));
    } catch (e: unknown) {
      setError(getErrorMessage(e, "Failed to load"));
    } finally {
      setListLoading(false);
    }
  }

  useEffect(() => {
    loadList();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function onGenerate() {
    setLoading(true);
    setError(null);

    try {
      const token = await getAccessToken();
      if (!token) throw new Error("Not logged in");

      const res = await fetch("/api/worksheets", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          subject,
          grade,
          topic,
          worksheetType,
          difficulty,
          contentMode,
          numQuestions,
          durationMins,
        }),
      });

      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error || "Generation failed");

      const payload = normalizeFullResponse(json);

      // If we got a meta row, prepend it. Otherwise reload.
      if (payload.meta?.id) {
        setItems((prev) => [payload.meta as WorksheetRow, ...prev]);
      } else {
        await loadList();
      }

      setActive({ meta: payload.meta, generated: payload.generated });
      setPrintMode("student");
      setOpen(true);
    } catch (e: unknown) {
      setError(getErrorMessage(e, "Something went wrong"));
    } finally {
      setLoading(false);
    }
  }

  async function onDelete(id: string) {
    if (!confirm("Delete this worksheet?")) return;

    setError(null);
    try {
      const token = await getAccessToken();
      if (!token) throw new Error("Not logged in");

      const res = await fetch(`/api/worksheets?id=${encodeURIComponent(id)}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });

      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error || "Delete failed");

      setItems((prev) => prev.filter((x) => x.id !== id));
      if (active?.meta?.id === id) {
        setOpen(false);
        setActive(null);
      }
    } catch (e: unknown) {
      setError(getErrorMessage(e, "Delete failed"));
    }
  }

  // ✅ When opening from the list, fetch full content so it won’t be “meta only”
  async function openFromRow(row: WorksheetRow) {
    setError(null);
    setActive({ meta: row, generated: undefined });
    setPrintMode("student");
    setOpen(true);

    try {
      const token = await getAccessToken();
      if (!token) throw new Error("Not logged in");

      const res = await fetch(`/api/worksheets?id=${encodeURIComponent(row.id)}&visuals=1`, {
        method: "GET",
        headers: { Authorization: `Bearer ${token}` },
      });

      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error || "Failed to load worksheet content");

      // IMPORTANT: your GET?id returns { ok:true, data:{ saved, generated } }
      const payload = normalizeFullResponse(json);

      // Keep meta from list if saved is missing
      setActive({
        meta: (payload.meta ?? row) as WorksheetRow,
        generated: payload.generated,
      });
    } catch (e: unknown) {
      // keep modal open with meta, but show error
      setError(getErrorMessage(e, "Failed to open worksheet"));
    }
  }

  async function copy(text: string) {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      alert("Copy failed. Please select and copy manually.");
    }
  }

  function escapeHtml(s: string) {
    return (s || "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  // ✅ SUREST PRINT: print a clean document in a new window
function printGenerated(mode: PrintMode) {
  const title = active?.generated?.title || active?.meta?.topic || "Worksheet";

  const metaSubject = active?.meta?.subject || "";
  const metaGrade = active?.meta?.grade || "";
  const metaTopic = active?.meta?.topic || "";

  const worksheet = active?.generated?.worksheet || "";
  const answerKey = active?.generated?.answerKey || "";
  const visuals = Array.isArray(active?.generated?.visuals) ? active?.generated?.visuals : [];

  if (!worksheet) {
    alert("Nothing to print yet. Click View (so it loads content) or Generate a worksheet first.");
    return;
  }

  const includeAnswer = mode === "teacher" && !!answerKey;
  const visualsHtml = visuals
    .map(
      (v, i) => `
      <div class="card">
        <div class="label">Visual ${i + 1}: ${escapeHtml(v.label || "Worksheet visual")}</div>
        <img src="${escapeHtml(v.imageDataUrl)}" alt="${escapeHtml(v.label || "visual")}" style="width:100%; max-width:680px; height:auto; border:1px solid #ddd; border-radius:8px;" />
      </div>
    `
    )
    .join("");

  const html = `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <title>${escapeHtml(title)}</title>
  <style>
    body { font-family: Arial, sans-serif; padding: 24px; color: #111; }
    h1 { font-size: 18pt; margin: 0 0 6px; }
    .meta { font-size: 11pt; color: #444; margin-bottom: 18px; }
    .card { border: 1px solid #ddd; border-radius: 10px; padding: 14px; margin: 0 0 16px; }
    .label { font-weight: 700; margin-bottom: 8px; }
    pre { white-space: pre-wrap; word-break: break-word; font-size: 11.5pt; line-height: 1.5; margin: 0; }
    .page-break { page-break-before: always; break-before: page; }
    @page { margin: 14mm; }
  </style>
</head>
<body>
  <h1>${escapeHtml(title)}</h1>
  <div class="meta">
    ${escapeHtml(metaSubject)}
    ${escapeHtml(metaGrade ? " • " + metaGrade : "")}
    ${escapeHtml(metaTopic ? " • " + metaTopic : "")}
    ${mode === "student" ? " • Student Copy" : " • Teacher Copy"}
  </div>

  <div class="card">
    <div class="label">Worksheet</div>
    <pre>${escapeHtml(worksheet)}</pre>
  </div>

  ${visualsHtml}

  ${
    includeAnswer
      ? `
      <div class="page-break"></div>
      <div class="card">
        <div class="label">Answer Key (Teacher)</div>
        <pre>${escapeHtml(answerKey)}</pre>
      </div>
    `
      : ""
  }
</body>
</html>`;

  // ✅ Print via hidden iframe (most reliable)
  const iframe = document.createElement("iframe");
  iframe.style.position = "fixed";
  iframe.style.right = "0";
  iframe.style.bottom = "0";
  iframe.style.width = "0";
  iframe.style.height = "0";
  iframe.style.border = "0";
  iframe.setAttribute("aria-hidden", "true");

  document.body.appendChild(iframe);

  const doc = iframe.contentWindow?.document;
  if (!doc || !iframe.contentWindow) {
    iframe.remove();
    alert("Print failed: cannot access print frame.");
    return;
  }

  doc.open();
  doc.write(html);
  doc.close();

  // Give browser a moment to render before printing
  setTimeout(() => {
    try {
      iframe.contentWindow?.focus();
      iframe.contentWindow?.print();
    } finally {
      // remove after print dialog opens
      setTimeout(() => iframe.remove(), 1000);
    }
  }, 250);
}

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Worksheets</h1>
          <p className="mt-1 text-sm text-slate-600">
            Generate printable worksheets + answer keys. (Auto-saved)
          </p>
        </div>

        <div className="w-full md:w-80">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search worksheets..."
            className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-violet-400"
          />
        </div>
      </div>

      {/* Builder */}
      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-6">
          <Field label="Subject" span="md:col-span-2">
            <input
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-violet-400"
            />
          </Field>

          <Field label="Grade / Class" span="md:col-span-2">
            <input
              value={grade}
              onChange={(e) => setGrade(e.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-violet-400"
            />
          </Field>

          <Field label="Duration (mins)" span="md:col-span-2">
            <input
              type="number"
              min={10}
              max={180}
              value={durationMins}
              onChange={(e) => setDurationMins(parseInt(e.target.value || "30", 10))}
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-violet-400"
            />
          </Field>

          <Field label="Topic" span="md:col-span-4">
            <input
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-violet-400"
            />
          </Field>

          <Field label="Worksheet Type" span="md:col-span-2">
            <select
              value={worksheetType}
              onChange={(e) => setWorksheetType(e.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-violet-400"
            >
              <option>Mixed</option>
              <option>Multiple Choice</option>
              <option>Short Answer</option>
              <option>Theory/Essay</option>
            </select>
          </Field>

          <Field label="Difficulty" span="md:col-span-2">
            <select
              value={difficulty}
              onChange={(e) => setDifficulty(e.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-violet-400"
            >
              <option>Easy</option>
              <option>Medium</option>
              <option>Hard</option>
            </select>
          </Field>

          <Field label="Content Mode" span="md:col-span-2">
            <select
              value={contentMode}
              onChange={(e) => setContentMode(e.target.value as ContentMode)}
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-violet-400"
            >
              <option value="normal">Normal</option>
              <option value="coloring">Coloring (Nursery)</option>
              <option value="diagram">Diagram</option>
              <option value="practical">Practical</option>
            </select>
          </Field>

          <Field label="No. of Questions" span="md:col-span-2">
            <input
              type="number"
              min={5}
              max={50}
              value={numQuestions}
              onChange={(e) => setNumQuestions(parseInt(e.target.value || "10", 10))}
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-violet-400"
            />
          </Field>

          <div className="md:col-span-2 flex items-end gap-2">
            <button
              onClick={onGenerate}
              disabled={loading}
              className="w-full rounded-xl bg-violet-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-violet-700 disabled:opacity-60"
            >
              {loading ? "Generating..." : "Generate & Auto-save"}
            </button>
          </div>
        </div>

        {error ? (
          <div className="mt-3 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            {error}
          </div>
        ) : null}
      </div>

      {/* List */}
      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex items-center justify-between">
          <div className="text-sm font-semibold text-slate-900">My Worksheets</div>
          <button
            onClick={loadList}
            disabled={listLoading}
            className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-800 hover:bg-slate-100 disabled:opacity-60"
          >
            {listLoading ? "Refreshing..." : "Refresh"}
          </button>
        </div>

        <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
          {filtered.map((w) => (
            <div
              key={w.id}
              className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-sm font-semibold text-slate-900 truncate">
                    {w.topic}
                  </div>
                  <div className="mt-1 text-xs text-slate-500">
                    {w.subject} • {w.grade}
                  </div>
                </div>
                <div className="text-[10px] text-slate-500">{timeAgo(w.created_at)}</div>
              </div>

              <div className="mt-3 flex flex-wrap gap-2">
                <Pill>{w.worksheet_type ?? "Mixed"}</Pill>
                <Pill>{w.difficulty ?? "Medium"}</Pill>
                <Pill>{w.num_questions ?? 10} Q</Pill>
              </div>

              <div className="mt-4 flex gap-2">
                <button
                  onClick={() => openFromRow(w)}
                  className="flex-1 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-800 hover:bg-slate-100"
                >
                  View
                </button>
                <button
                  onClick={() => onDelete(w.id)}
                  className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs font-semibold text-red-700 hover:bg-red-100"
                >
                  Delete
                </button>
              </div>
            </div>
          ))}

          {!listLoading && filtered.length === 0 ? (
            <div className="md:col-span-2 lg:col-span-3 rounded-xl bg-slate-50 p-4 text-sm text-slate-600">
              No worksheets yet. Generate one to see it here.
            </div>
          ) : null}
        </div>
      </div>

      {/* Modal */}
      {open ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-3xl rounded-2xl bg-white shadow-xl">
            <div className="flex items-start justify-between gap-3 border-b border-slate-200 p-4">
              <div className="min-w-0">
                <div className="text-sm font-semibold text-slate-900 truncate">
                  {active?.generated?.title || active?.meta?.topic || "Worksheet"}
                </div>
                <div className="mt-1 text-xs text-slate-500">
                  {active?.meta?.subject} • {active?.meta?.grade}
                </div>
              </div>

              <div className="flex items-center gap-2">
                {/* Print Mode Toggle */}
                <select
                  value={printMode}
                  onChange={(e) => setPrintMode(e.target.value as PrintMode)}
                  className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-800 outline-none"
                  title="Choose print mode"
                >
                  <option value="student">Student copy</option>
                  <option value="teacher">Teacher copy</option>
                </select>

                <button
                  onClick={() => printGenerated(printMode)}
                  className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-800 hover:bg-slate-100"
                >
                  Print
                </button>

                <button
                  onClick={() => {
                    setOpen(false);
                    setActive(null);
                  }}
                  className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-800 hover:bg-slate-100"
                >
                  Close
                </button>
              </div>
            </div>

            {/* ✅ Scrollable content area */}
            <div className="max-h-[70vh] overflow-auto p-4 space-y-4">
              {active?.generated?.worksheet ? (
                <>
                  <div className="flex items-center justify-between">
                    <div className="text-xs font-semibold text-slate-900">Worksheet</div>
                    <button
                      onClick={() => copy(active.generated?.worksheet ?? "")}
                      className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-800 hover:bg-slate-100"
                    >
                      Copy
                    </button>
                  </div>

                  <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                    <div className="whitespace-pre-wrap text-sm text-slate-900 leading-6">
                      {active.generated.worksheet}
                    </div>
                  </div>

                  {Array.isArray(active?.generated?.visuals) &&
                  active.generated.visuals.length > 0 ? (
                    <div className="rounded-xl border border-slate-200 bg-white p-3">
                      <div className="text-xs font-semibold text-slate-900">
                        {active.generated.contentMode === "coloring"
                          ? "Coloring Outline Pictures"
                          : "Diagram / Practical Outline Pictures"}
                      </div>
                      <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2">
                        {active.generated.visuals.map((v, idx) => (
                          <div key={`${v.label}-${idx}`} className="rounded-xl border border-slate-200 bg-slate-50 p-2">
                            <div className="mb-2 text-xs font-medium text-slate-700">{v.label}</div>
                            <img
                              src={v.imageDataUrl}
                              alt={v.label}
                              className="w-full rounded-lg border border-slate-200 bg-white"
                            />
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : null}

                  {/* Teacher-only preview in UI */}
                  {active?.generated?.answerKey ? (
                    <div className="rounded-xl border border-slate-200 bg-white p-3">
                      <div className="flex items-center justify-between">
                        <div className="text-xs font-semibold text-slate-900">
                          Answer Key (Teacher)
                        </div>
                        <button
                          onClick={() => copy(active.generated?.answerKey ?? "")}
                          className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-800 hover:bg-slate-100"
                        >
                          Copy
                        </button>
                      </div>

                      <div className="mt-2 rounded-xl bg-slate-50 p-3">
                        <div className="whitespace-pre-wrap text-sm text-slate-900 leading-6">
                          {active.generated.answerKey}
                        </div>
                      </div>
                    </div>
                  ) : null}
                </>
              ) : (
                <div className="rounded-xl bg-slate-50 p-4 text-sm text-slate-600">
                  This item is loaded as meta only (content not fetched yet).
                  <br />
                  Click <span className="font-semibold">View</span> again or refresh.
                  <br />
                  If it still persists, confirm your API supports:
                  <span className="font-mono"> GET /api/worksheets?id=...</span>
                </div>
              )}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function Field({
  label,
  children,
  span,
}: {
  label: string;
  children: React.ReactNode;
  span?: string;
}) {
  return (
    <div className={span ?? ""}>
      <div className="mb-1 text-xs font-medium text-slate-600">{label}</div>
      {children}
    </div>
  );
}

function Pill({ children }: { children: React.ReactNode }) {
  return (
    <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[11px] font-semibold text-slate-700">
      {children}
    </span>
  );
}

function timeAgo(iso: string) {
  const t = new Date(iso).getTime();
  const diff = Date.now() - t;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

/**
 * Optional helpers if your API returns JSON-shaped worksheet objects (result_json)
 * These keep your UI stable even if the backend returns structured JSON sometimes.
 */
function stringifyWorksheetFromJson(resultJson: unknown): string {
  try {
    const root = (resultJson ?? {}) as Record<string, unknown>;
    const meta = (root.meta ?? {}) as Record<string, unknown>;
    const w = (root.worksheet ?? {}) as Record<string, unknown>;
    const title = w?.title ? `${w.title}\n\n` : "";

    const instructions = Array.isArray(w?.instructions)
      ? `Instructions:\n${w.instructions.map((x: string) => `- ${x}`).join("\n")}\n\n`
      : "";

    const questions = Array.isArray(w?.questions)
      ? w.questions
          .map((q: unknown, i: number) => {
            const question = (q ?? {}) as Record<string, unknown>;
            const n = i + 1;
            if (question?.type === "mcq") {
              const opts = Array.isArray(question?.options)
                ? (question.options as unknown[])
                    .map(
                      (o: string, j: number) =>
                        `   ${String.fromCharCode(65 + j)}. ${o}`
                    )
                    .join("\n")
                : "";
              return `${n}. ${question?.q ?? ""}\n${opts}`;
            }
            if (question?.type === "short") return `${n}. ${question?.q ?? ""}`;
            if (question?.type === "theory") return `${n}. ${question?.q ?? ""}`;
            return `${n}. ${question?.q ?? ""}`;
          })
          .join("\n\n")
      : "";

    const headerParts = [
      meta?.subject ? `${meta.subject}` : "",
      meta?.grade ? `• ${meta.grade}` : "",
      meta?.topic ? `• ${meta.topic}` : "",
    ].filter(Boolean);

    const header = headerParts.length ? `${headerParts.join(" ")}\n\n` : "";

    return `${header}${title}${instructions}${questions}`.trim();
  } catch {
    return "";
  }
}

function stringifyAnswerKeyFromJson(resultJson: unknown): string {
  try {
    const root = (resultJson ?? {}) as Record<string, unknown>;
    const ak = root.answerKey;
    if (typeof ak === "string") return ak;
    if (!Array.isArray(ak)) return "";

    return ak
      .map((x: unknown) => {
        const obj = (x ?? {}) as Record<string, unknown>;
        const idx = obj?.qIndex ?? "";
        const ans = obj?.answer ?? "";
        return `${idx}. ${ans}`;
      })
      .join("\n");
  } catch {
    return "";
  }
}
