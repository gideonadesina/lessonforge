"use client";
 
import { useEffect, useMemo, useState } from "react";
import { createBrowserSupabase } from "@/lib/supabase/browser";
 
type WorksheetSource = "generated" | "uploaded";
type PrintLayout = "standard" | "exam" | "worksheet";
type ContentMode = "normal" | "diagram" | "coloring" | "practical" | "answer_key";
type PrintMode = "student" | "teacher";
 
type WorksheetRow = {
  id: string;
  subject: string;
  topic: string;
  grade: string;
  worksheet_type: string | null;
  difficulty: string | null;
  num_questions: number | null;
  duration_mins: number | null;
 
  title: string | null;
  school_name?: string | null;
  class_name?: string | null;
  worksheet_date?: string | null;
 
  source?: WorksheetSource | null;
  file_url?: string | null;
  file_name?: string | null;
  file_type?: string | null;
  print_layout?: PrintLayout | null;
  content_mode?: ContentMode | null;
 
  created_at: string;
  updated_at?: string;
};
 
type WorksheetVisual = {
  label: string;
  imageDataUrl: string;
};
 
type GeneratedPayload = {
  title?: string;
  instructions?: string[];
  worksheet?: string;
  answerKey?: string;
  contentMode?: ContentMode;
  visuals?: WorksheetVisual[];
};
 
type ActiveState = {
  meta?: WorksheetRow;
  generated?: GeneratedPayload;
};
 
type EditDraft = {
  title: string;
  schoolName: string;
  className: string;
  worksheetDate: string;
  instructionsText: string;
  worksheet: string;
  answerKey: string;
  printLayout: PrintLayout;
  contentMode: ContentMode;
  worksheetType: string;
  difficulty: string;
  numQuestions: number;
  durationMins: number;
};
 
function splitInstructions(v: string) {
  return v
    .split(/\r?\n/)
    .map((x) => x.trim())
    .filter(Boolean);
}
 
function toSafeInt(v: string, fallback: number) {
  const x = parseInt(v || `${fallback}`, 10);
  return Number.isFinite(x) ? x : fallback;
}
 
function getFilenameFromDisposition(disposition: string | null, fallback: string) {
  if (!disposition) return fallback;
  const m = disposition.match(/filename\*?=(?:UTF-8''|")?([^\";]+)/i);
  if (!m?.[1]) return fallback;
  try {
    return decodeURIComponent(m[1].replace(/"/g, ""));
  } catch {
    return m[1].replace(/"/g, "");
  }
}
 
function getErrorMessage(error: unknown, fallback: string) {
  if (error && typeof error === "object" && "message" in error) {
    return String((error as { message?: unknown }).message ?? fallback);
  }
  return fallback;
}
 
export default function WorksheetsPage() {
  // Builder state
  const [sourceMode, setSourceMode] = useState<WorksheetSource>("generated");
  const [subject, setSubject] = useState("Basic Science");
  const [grade, setGrade] = useState("Grade 4");
  const [topic, setTopic] = useState("Alimentary Canal");
  const [worksheetType, setWorksheetType] = useState("Mixed");
  const [difficulty, setDifficulty] = useState("Medium");
  const [numQuestions, setNumQuestions] = useState(10);
  const [durationMins, setDurationMins] = useState(30);
 
  const [title, setTitle] = useState("");
  const [schoolName, setSchoolName] = useState("");
  const [className, setClassName] = useState("");
  const [worksheetDate, setWorksheetDate] = useState("");
 
  const [printLayout, setPrintLayout] = useState<PrintLayout>("standard");
  const [contentMode, setContentMode] = useState<ContentMode>("normal");
 
  const [instructionsText, setInstructionsText] = useState("Answer all questions.");
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadedWorksheetText, setUploadedWorksheetText] = useState("");
  const [uploadedAnswerKeyText, setUploadedAnswerKeyText] = useState("");
 
  // Page state
  const [loading, setLoading] = useState(false);
  const [listLoading, setListLoading] = useState(false);
  const [savingEdit, setSavingEdit] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
 
  const [items, setItems] = useState<WorksheetRow[]>([]);
  const [query, setQuery] = useState("");
 
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState<ActiveState | null>(null);
  const [printMode, setPrintMode] = useState<PrintMode>("student");
 
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<EditDraft | null>(null);
 
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return items;
 
    return items.filter((x) => {
      const t = `${x.title ?? ""} ${x.topic} ${x.subject} ${x.grade} ${x.source ?? ""}`.toLowerCase();
      return t.includes(q);
    });
  }, [items, query]);
 
  async function getAccessToken() {
    const supabase = createBrowserSupabase();
    const { data } = await supabase.auth.getSession();
    return data.session?.access_token ?? "";
  }
 
  function normalizeListResponse(json: unknown): WorksheetRow[] {
    const root = (json ?? {}) as { data?: unknown };
    const inner = (root.data ?? {}) as { data?: unknown };
 
    const list =
      (Array.isArray(root.data) ? root.data : null) ??
      (Array.isArray(inner.data) ? inner.data : null) ??
      (Array.isArray(json) ? json : null) ??
      [];
 
    return list as WorksheetRow[];
  }
 
  function normalizeFullResponse(json: unknown): { meta?: WorksheetRow; generated?: GeneratedPayload } {
    const root = (json ?? {}) as Record<string, unknown>;
    const payload = (root.data ?? root) as Record<string, unknown>;
    const payloadData = (payload.data ?? {}) as Record<string, unknown>;
 
    const saved =
      payload.saved ??
      payloadData.saved ??
      payload.data ??
      payload.row ??
      null;
 
    const generated =
      (payload.generated as GeneratedPayload | undefined) ??
      (payloadData.generated as GeneratedPayload | undefined) ??
      undefined;
 
    return {
      meta: (saved as WorksheetRow | undefined) ?? undefined,
      generated,
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
      if (!res.ok) throw new Error((json as { error?: string })?.error || "Failed to load worksheets");
      setItems(normalizeListResponse(json));
    } catch (e: unknown) {
      setError(getErrorMessage(e, "Failed to load worksheets"));
    } finally {
      setListLoading(false);
    }
  }
 
  useEffect(() => {
    loadList();
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
          source: "generated",
          subject,
          grade,
          topic,
          worksheetType,
          difficulty,
          numQuestions,
          durationMins,
          title: title || undefined,
          schoolName: schoolName || undefined,
          className: className || undefined,
          worksheetDate: worksheetDate || undefined,
          printLayout,
          contentMode,
          instructions: splitInstructions(instructionsText),
        }),
      });
 
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error((json as { error?: string })?.error || "Generation failed");
 
      const payload = normalizeFullResponse(json);
 
      if (payload.meta?.id) {
        setItems((prev) => [payload.meta as WorksheetRow, ...prev]);
      } else {
        await loadList();
      }
 
      setActive({ meta: payload.meta, generated: payload.generated });
      setPrintMode("student");
      setOpen(true);
    } catch (e: unknown) {
      setError(getErrorMessage(e, "Generation failed"));
    } finally {
      setLoading(false);
    }
  }
 
  async function onUpload() {
    setLoading(true);
    setError(null);
 
    try {
      if (!uploadFile) throw new Error("Please select a file to upload");
 
      const token = await getAccessToken();
      if (!token) throw new Error("Not logged in");
 
      const form = new FormData();
      form.append("file", uploadFile);
      form.append("subject", subject);
      form.append("grade", grade);
      form.append("topic", topic);
      form.append("worksheetType", worksheetType);
      form.append("difficulty", difficulty);
      form.append("numQuestions", String(numQuestions));
      form.append("durationMins", String(durationMins));
      form.append("title", title);
      form.append("schoolName", schoolName);
      form.append("className", className);
      form.append("worksheetDate", worksheetDate);
      form.append("printLayout", printLayout);
      form.append("contentMode", contentMode);
      form.append("instructions", JSON.stringify(splitInstructions(instructionsText)));
      form.append("worksheet", uploadedWorksheetText);
      form.append("answerKey", uploadedAnswerKeyText);
 
      const res = await fetch("/api/worksheets/upload", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
        },
        body: form,
      });
 
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error((json as { error?: string })?.error || "Upload failed");
 
      const payload = normalizeFullResponse(json);
 
      if (payload.meta?.id) {
        setItems((prev) => [payload.meta as WorksheetRow, ...prev]);
      } else {
        await loadList();
      }
 
      setActive({ meta: payload.meta, generated: payload.generated });
      setPrintMode("student");
      setOpen(true);
 
      setUploadFile(null);
    } catch (e: unknown) {
      setError(getErrorMessage(e, "Upload failed"));
    } finally {
      setLoading(false);
    }
  }
 
  async function onSubmit() {
    if (sourceMode === "generated") return onGenerate();
    return onUpload();
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
      if (!res.ok) throw new Error((json as { error?: string })?.error || "Delete failed");
 
      setItems((prev) => prev.filter((x) => x.id !== id));
      if (active?.meta?.id === id) {
        setOpen(false);
        setActive(null);
      }
    } catch (e: unknown) {
      setError(getErrorMessage(e, "Delete failed"));
    }
  }
 
  async function openFromRow(row: WorksheetRow) {
    setError(null);
    setActive({ meta: row, generated: undefined });
    setPrintMode("student");
    setOpen(true);
    setEditing(false);
    setDraft(null);
 
    try {
      const token = await getAccessToken();
      if (!token) throw new Error("Not logged in");
 
      // IMPORTANT: visuals=1 tells backend to include generated visuals
      const res = await fetch(`/api/worksheets?id=${encodeURIComponent(row.id)}&visuals=1`, {
        method: "GET",
        headers: { Authorization: `Bearer ${token}` },
      });
 
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error((json as { error?: string })?.error || "Failed to load worksheet");
 
      const payload = normalizeFullResponse(json);
      setActive({
        meta: (payload.meta ?? row) as WorksheetRow,
        generated: payload.generated,
      });
    } catch (e: unknown) {
      setError(getErrorMessage(e, "Failed to open worksheet"));
    }
  }
 
  function startEdit() {
    if (!active?.meta) return;
 
    setDraft({
      title: active.generated?.title ?? active.meta.title ?? "",
      schoolName: active.meta.school_name ?? "",
      className: active.meta.class_name ?? "",
      worksheetDate: active.meta.worksheet_date ?? "",
      instructionsText: (active.generated?.instructions ?? []).join("\n"),
      worksheet: active.generated?.worksheet ?? "",
      answerKey: active.generated?.answerKey ?? "",
      printLayout: (active.meta.print_layout as PrintLayout) ?? "standard",
      contentMode: (active.meta.content_mode as ContentMode) ?? "normal",
      worksheetType: active.meta.worksheet_type ?? "",
      difficulty: active.meta.difficulty ?? "",
      numQuestions: active.meta.num_questions ?? 10,
      durationMins: active.meta.duration_mins ?? 30,
    });
 
    setEditing(true);
  }
 
  async function saveEdit() {
    if (!active?.meta?.id || !draft) return;
    setSavingEdit(true);
    setError(null);
 
    try {
      const token = await getAccessToken();
      if (!token) throw new Error("Not logged in");
 
      const res = await fetch("/api/worksheets", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          id: active.meta.id,
          title: draft.title || null,
          schoolName: draft.schoolName || null,
          className: draft.className || null,
          worksheetDate: draft.worksheetDate || null,
          instructions: splitInstructions(draft.instructionsText),
          worksheet: draft.worksheet,
          answerKey: draft.answerKey,
          printLayout: draft.printLayout,
          contentMode: draft.contentMode,
          worksheetType: draft.worksheetType || null,
          difficulty: draft.difficulty || null,
          numQuestions: draft.numQuestions,
          durationMins: draft.durationMins,
        }),
      });
 
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error((json as { error?: string })?.error || "Update failed");
 
      const payload = normalizeFullResponse(json);
      if (payload.meta) {
        setItems((prev) =>
          prev.map((x) => (x.id === payload.meta!.id ? (payload.meta as WorksheetRow) : x))
        );
      }
 
      setActive({
        meta: (payload.meta ?? active.meta) as WorksheetRow,
        generated: payload.generated ?? active.generated,
      });
 
      setEditing(false);
      setDraft(null);
    } catch (e: unknown) {
      setError(getErrorMessage(e, "Update failed"));
    } finally {
      setSavingEdit(false);
    }
  }
 
  async function downloadExport(kind: "pdf" | "docx") {
    if (!active?.meta?.id) return;
    setExporting(true);
    setError(null);
 
    try {
      const token = await getAccessToken();
      if (!token) throw new Error("Not logged in");
 
      const url = `/api/worksheets/export/${kind}?id=${encodeURIComponent(
        active.meta.id
      )}&mode=${printMode}`;
 
      const res = await fetch(url, {
        method: "GET",
        headers: { Authorization: `Bearer ${token}` },
      });
 
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        throw new Error((json as { error?: string })?.error || `Failed to export ${kind.toUpperCase()}`);
      }
 
      const blob = await res.blob();
      const fallback = `worksheet-${active.meta.id}.${kind}`;
      const fileName = getFilenameFromDisposition(res.headers.get("content-disposition"), fallback);
 
      const blobUrl = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = blobUrl;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(blobUrl);
    } catch (e: unknown) {
      setError(getErrorMessage(e, `Failed to export ${kind.toUpperCase()}`));
    } finally {
      setExporting(false);
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
 
  function printGenerated(mode: PrintMode) {
    const titleText = active?.generated?.title || active?.meta?.title || active?.meta?.topic || "Worksheet";
 
    const metaSubject = active?.meta?.subject || "";
    const metaGrade = active?.meta?.grade || "";
    const metaTopic = active?.meta?.topic || "";
 
    const worksheet = active?.generated?.worksheet || "";
    const answerKey = active?.generated?.answerKey || "";
    const visuals = Array.isArray(active?.generated?.visuals) ? active.generated!.visuals! : [];
 
    if (!worksheet) {
      alert("Nothing to print yet.");
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
  <title>${escapeHtml(titleText)}</title>
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
  <h1>${escapeHtml(titleText)}</h1>
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
      alert("Print failed.");
      return;
    }
 
    doc.open();
    doc.write(html);
    doc.close();
 
    setTimeout(() => {
      try {
        iframe.contentWindow?.focus();
        iframe.contentWindow?.print();
      } finally {
        setTimeout(() => iframe.remove(), 1000);
      }
    }, 250);
  }
 
  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Worksheets</h1>
          <p className="mt-1 text-sm text-slate-600">
            Generate, upload, edit, and export worksheets (PDF / DOCX).
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
 
      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="mb-4 flex gap-2">
          <button
            onClick={() => setSourceMode("generated")}
            className={`rounded-xl px-3 py-2 text-xs font-semibold ${
              sourceMode === "generated"
                ? "bg-violet-600 text-white"
                : "border border-slate-200 bg-white text-slate-800"
            }`}
          >
            Generate
          </button>
          <button
            onClick={() => setSourceMode("uploaded")}
            className={`rounded-xl px-3 py-2 text-xs font-semibold ${
              sourceMode === "uploaded"
                ? "bg-violet-600 text-white"
                : "border border-slate-200 bg-white text-slate-800"
            }`}
          >
            Upload
          </button>
        </div>
 
        <div className="grid grid-cols-1 gap-3 md:grid-cols-8">
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
 
          <Field label="Topic" span="md:col-span-4">
            <input
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-violet-400"
            />
          </Field>
 
          <Field label="Title (optional)" span="md:col-span-3">
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-violet-400"
            />
          </Field>
 
          <Field label="School Name" span="md:col-span-2">
            <input
              value={schoolName}
              onChange={(e) => setSchoolName(e.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-violet-400"
            />
          </Field>
 
          <Field label="Class Name" span="md:col-span-2">
            <input
              value={className}
              onChange={(e) => setClassName(e.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-violet-400"
            />
          </Field>
 
          <Field label="Date" span="md:col-span-1">
            <input
              type="date"
              value={worksheetDate}
              onChange={(e) => setWorksheetDate(e.target.value)}
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
 
          <Field label="No. Questions" span="md:col-span-2">
            <input
              type="number"
              min={1}
              max={50}
              value={numQuestions}
              onChange={(e) => setNumQuestions(toSafeInt(e.target.value, 10))}
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-violet-400"
            />
          </Field>
 
          <Field label="Duration (mins)" span="md:col-span-2">
            <input
              type="number"
              min={10}
              max={180}
              value={durationMins}
              onChange={(e) => setDurationMins(toSafeInt(e.target.value, 30))}
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-violet-400"
            />
          </Field>
 
          <Field label="Print Layout" span="md:col-span-2">
            <select
              value={printLayout}
              onChange={(e) => setPrintLayout(e.target.value as PrintLayout)}
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-violet-400"
            >
              <option value="standard">standard</option>
              <option value="exam">exam</option>
              <option value="worksheet">worksheet</option>
            </select>
          </Field>
 
          <Field label="Content Mode" span="md:col-span-2">
            <select
              value={contentMode}
              onChange={(e) => setContentMode(e.target.value as ContentMode)}
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-violet-400"
            >
              <option value="normal">normal</option>
              <option value="diagram">diagram</option>
              <option value="coloring">coloring</option>
              <option value="practical">practical</option>
              <option value="answer_key">answer_key</option>
            </select>
          </Field>
 
          <Field label="Instructions (one per line)" span="md:col-span-8">
            <textarea
              value={instructionsText}
              onChange={(e) => setInstructionsText(e.target.value)}
              rows={3}
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-violet-400"
            />
          </Field>
 
          {sourceMode === "uploaded" ? (
            <>
              <Field label="Upload File" span="md:col-span-4">
                <input
                  type="file"
                  accept=".pdf,.doc,.docx,.txt,.png,.jpg,.jpeg"
                  onChange={(e) => setUploadFile(e.target.files?.[0] ?? null)}
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none"
                />
              </Field>
 
              <Field label="Worksheet text (optional)" span="md:col-span-4">
                <textarea
                  rows={4}
                  value={uploadedWorksheetText}
                  onChange={(e) => setUploadedWorksheetText(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-violet-400"
                />
              </Field>
 
              <Field label="Answer key (optional)" span="md:col-span-8">
                <textarea
                  rows={4}
                  value={uploadedAnswerKeyText}
                  onChange={(e) => setUploadedAnswerKeyText(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-violet-400"
                />
              </Field>
            </>
          ) : null}
 
          <div className="md:col-span-8 flex justify-end">
            <button
              onClick={onSubmit}
              disabled={loading}
              className="rounded-xl bg-violet-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-violet-700 disabled:opacity-60"
            >
              {loading
                ? sourceMode === "generated"
                  ? "Generating..."
                  : "Uploading..."
                : sourceMode === "generated"
                ? "Generate & Save"
                : "Upload & Save"}
            </button>
          </div>
        </div>
 
        {error ? (
          <div className="mt-3 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            {error}
          </div>
        ) : null}
      </div>
 
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
            <div key={w.id} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="truncate text-sm font-semibold text-slate-900">
                    {w.title || w.topic}
                  </div>
                  <div className="mt-1 text-xs text-slate-500">
                    {w.subject} • {w.grade}
                  </div>
                </div>
                <div className="text-[10px] text-slate-500">{timeAgo(w.created_at)}</div>
              </div>
 
              <div className="mt-3 flex flex-wrap gap-2">
                <Pill>{w.source ?? "generated"}</Pill>
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
              No worksheets yet.
            </div>
          ) : null}
        </div>
      </div>
 
      {open ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-5xl rounded-2xl bg-white shadow-xl">
            <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-200 p-4">
              <div className="min-w-0">
                <div className="truncate text-sm font-semibold text-slate-900">
                  {active?.generated?.title || active?.meta?.title || active?.meta?.topic || "Worksheet"}
                </div>
                <div className="mt-1 text-xs text-slate-500">
                  {active?.meta?.subject} • {active?.meta?.grade} • {active?.meta?.source ?? "generated"}
                </div>
              </div>
 
              <div className="flex flex-wrap items-center gap-2">
                <select
                  value={printMode}
                  onChange={(e) => setPrintMode(e.target.value as PrintMode)}
                  className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-800 outline-none"
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
                  disabled={exporting}
                  onClick={() => downloadExport("pdf")}
                  className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-800 hover:bg-slate-100 disabled:opacity-60"
                >
                  Export PDF
                </button>
 
                <button
                  disabled={exporting}
                  onClick={() => downloadExport("docx")}
                  className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-800 hover:bg-slate-100 disabled:opacity-60"
                >
                  Export DOCX
                </button>
 
                {!editing ? (
                  <button
                    onClick={startEdit}
                    className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-800 hover:bg-slate-100"
                  >
                    Edit
                  </button>
                ) : (
                  <>
                    <button
                      disabled={savingEdit}
                      onClick={saveEdit}
                      className="rounded-xl bg-violet-600 px-3 py-2 text-xs font-semibold text-white hover:bg-violet-700 disabled:opacity-60"
                    >
                      {savingEdit ? "Saving..." : "Save"}
                    </button>
                    <button
                      onClick={() => {
                        setEditing(false);
                        setDraft(null);
                      }}
                      className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-800 hover:bg-slate-100"
                    >
                      Cancel
                    </button>
                  </>
                )}
 
                <button
                  onClick={() => {
                    setOpen(false);
                    setActive(null);
                    setEditing(false);
                    setDraft(null);
                  }}
                  className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-800 hover:bg-slate-100"
                >
                  Close
                </button>
              </div>
            </div>
 
            <div className="max-h-[75vh] space-y-4 overflow-auto p-4">
              {active?.meta?.source === "uploaded" && active?.meta?.file_url ? (
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm">
                  Uploaded file:{" "}
                  <a
                    href={active.meta.file_url}
                    target="_blank"
                    rel="noreferrer"
                    className="font-semibold text-violet-700 underline"
                  >
                    {active.meta.file_name || "Open file"}
                  </a>
                </div>
              ) : null}
 
              {editing && draft ? (
                <div className="space-y-4 rounded-xl border border-slate-200 bg-slate-50 p-4">
                  <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                    <Field label="Title">
                      <input
                        value={draft.title}
                        onChange={(e) => setDraft((d) => (d ? { ...d, title: e.target.value } : d))}
                        className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none"
                      />
                    </Field>
 
                    <Field label="School Name">
                      <input
                        value={draft.schoolName}
                        onChange={(e) => setDraft((d) => (d ? { ...d, schoolName: e.target.value } : d))}
                        className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none"
                      />
                    </Field>
 
                    <Field label="Class Name">
                      <input
                        value={draft.className}
                        onChange={(e) => setDraft((d) => (d ? { ...d, className: e.target.value } : d))}
                        className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none"
                      />
                    </Field>
 
                    <Field label="Date">
                      <input
                        type="date"
                        value={draft.worksheetDate}
                        onChange={(e) => setDraft((d) => (d ? { ...d, worksheetDate: e.target.value } : d))}
                        className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none"
                      />
                    </Field>
 
                    <Field label="Print Layout">
                      <select
                        value={draft.printLayout}
                        onChange={(e) =>
                          setDraft((d) => (d ? { ...d, printLayout: e.target.value as PrintLayout } : d))
                        }
                        className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none"
                      >
                        <option value="standard">standard</option>
                        <option value="exam">exam</option>
                        <option value="worksheet">worksheet</option>
                      </select>
                    </Field>
 
                    <Field label="Content Mode">
                      <select
                        value={draft.contentMode}
                        onChange={(e) =>
                          setDraft((d) => (d ? { ...d, contentMode: e.target.value as ContentMode } : d))
                        }
                        className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none"
                      >
                        <option value="normal">normal</option>
                        <option value="diagram">diagram</option>
                        <option value="coloring">coloring</option>
                        <option value="practical">practical</option>
                        <option value="answer_key">answer_key</option>
                      </select>
                    </Field>
                  </div>
 
                  <Field label="Instructions (one per line)">
                    <textarea
                      rows={3}
                      value={draft.instructionsText}
                      onChange={(e) => setDraft((d) => (d ? { ...d, instructionsText: e.target.value } : d))}
                      className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none"
                    />
                  </Field>
 
                  <Field label="Worksheet">
                    <textarea
                      rows={10}
                      value={draft.worksheet}
                      onChange={(e) => setDraft((d) => (d ? { ...d, worksheet: e.target.value } : d))}
                      className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none"
                    />
                  </Field>
 
                  <Field label="Answer Key">
                    <textarea
                      rows={8}
                      value={draft.answerKey}
                      onChange={(e) => setDraft((d) => (d ? { ...d, answerKey: e.target.value } : d))}
                      className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none"
                    />
                  </Field>
                </div>
              ) : active?.generated?.worksheet ? (
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
                    <div className="whitespace-pre-wrap text-sm leading-6 text-slate-900">
                      {active.generated.worksheet}
                    </div>
                  </div>
 
                  {Array.isArray(active?.generated?.visuals) && active.generated.visuals.length > 0 ? (
                    <div className="rounded-xl border border-slate-200 bg-white p-3">
                      <div className="text-xs font-semibold text-slate-900">
                        {active.generated.contentMode === "coloring"
                          ? "Coloring Outline Pictures"
                          : "Diagram / Practical Outline Pictures"}
                      </div>
                      <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2">
                        {active.generated.visuals.map((v, idx) => (
                          <div
                            key={`${v.label}-${idx}`}
                            className="rounded-xl border border-slate-200 bg-slate-50 p-2"
                          >
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
 
                  {active?.generated?.answerKey ? (
                    <div className="rounded-xl border border-slate-200 bg-white p-3">
                      <div className="flex items-center justify-between">
                        <div className="text-xs font-semibold text-slate-900">Answer Key</div>
                        <button
                          onClick={() => copy(active.generated?.answerKey ?? "")}
                          className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-800 hover:bg-slate-100"
                        >
                          Copy
                        </button>
                      </div>
                      <div className="mt-2 rounded-xl bg-slate-50 p-3">
                        <div className="whitespace-pre-wrap text-sm leading-6 text-slate-900">
                          {active.generated.answerKey}
                        </div>
                      </div>
                    </div>
                  ) : null}
                </>
              ) : (
                <div className="rounded-xl bg-slate-50 p-4 text-sm text-slate-600">
                  This item currently has no generated worksheet text.
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
