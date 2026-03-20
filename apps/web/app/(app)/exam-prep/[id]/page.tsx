"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "next/navigation";

type ExamType = "waec" | "neco";
type QType = "mcq" | "theory";

const SUBJECTS = [
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

function clsx(...x: Array<string | false | null | undefined>) {
  return x.filter(Boolean).join(" ");
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

function normalizeOptions(options: any): Record<"A" | "B" | "C" | "D", string> | null {
  if (!options) return null;
  if (Array.isArray(options) && options.length >= 4) {
    const [a, b, c, d] = options;
    if ([a, b, c, d].every((v) => typeof v === "string")) return { A: a, B: b, C: c, D: d };
    return null;
  }
  if (typeof options === "object") {
    const A = options.A ?? options.a;
    const B = options.B ?? options.b;
    const C = options.C ?? options.c;
    const D = options.D ?? options.d;
    if ([A, B, C, D].every((v) => typeof v === "string")) return { A, B, C, D };
  }
  return null;
}

const PAPER_ID = "lessonforge-exam-paper";

export default function ExamEditorPage() {
  const params = useParams();
  const examId = String(params?.id || "");

  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const [teacherMode, setTeacherMode] = useState(false);
  const [tab, setTab] = useState<"manual" | "paste" | "preview">("manual");

  // Exam data
  const [paper, setPaper] = useState<any | null>(null);
  const questions: any[] = paper?.questions ?? [];

  // Meta (editable)
  const [title, setTitle] = useState("");
  const [subject, setSubject] = useState<(typeof SUBJECTS)[number]>("English Language");
  const [grade, setGrade] = useState("SS3");
  const [examType, setExamType] = useState<ExamType>("waec");
  const [durationMins, setDurationMins] = useState<number>(90);

  // Manual MCQ form
  const [mcqPrompt, setMcqPrompt] = useState("");
  const [optA, setOptA] = useState("");
  const [optB, setOptB] = useState("");
  const [optC, setOptC] = useState("");
  const [optD, setOptD] = useState("");
  const [mcqAnswer, setMcqAnswer] = useState<"A" | "B" | "C" | "D">("A");

  // Manual Theory form
  const [theoryPrompt, setTheoryPrompt] = useState("");
  const [markingGuide, setMarkingGuide] = useState(""); // newline bullets

  // Paste import
  const [rawText, setRawText] = useState("");
  const [pastePreview, setPastePreview] = useState<any[] | null>(null);

  const metaDirtyRef = useRef(false);
  const debounceRef = useRef<any>(null);

  async function load() {
    if (!examId) return;

    setLoading(true);
    setMsg(null);

    const res = await postJson<any>("/api/exam-prep/get", { id: examId });

    if (!res.ok) {
      setMsg((res.data as any)?.error ?? `Failed to load (${res.status})`);
      setLoading(false);
      return;
    }

    // Expecting server to return { paper: {...} } OR { set: {...} }
    const loaded = (res.data as any)?.paper ?? (res.data as any)?.set ?? res.data;
    setPaper(loaded);

    setTitle(String(loaded?.title ?? ""));
    setSubject((loaded?.subject ?? "English Language") as any);
    setGrade(String(loaded?.grade ?? "SS3"));
    setExamType(((loaded?.exam_type ?? "waec") as ExamType) || "waec");
    setDurationMins(Number(loaded?.duration_mins ?? 90));

    setLoading(false);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [examId]);

  // Auto-save meta (debounced)
  useEffect(() => {
    if (!paper?.id) return;
    if (!metaDirtyRef.current) return;

    if (debounceRef.current) clearTimeout(debounceRef.current);

    debounceRef.current = setTimeout(async () => {
      setMsg(null);
      const res = await postJson<any>("/api/exam-prep/update", {
        id: examId,
        title,
        subject,
        grade,
        exam_type: examType,
        duration_mins: durationMins,
      });

      if (!res.ok) {
        setMsg((res.data as any)?.error ?? "Failed to save changes");
        return;
      }

      metaDirtyRef.current = false;
      setMsg("Saved ✅");
    }, 700);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [title, subject, grade, examType, durationMins]);

  function markDirty() {
    metaDirtyRef.current = true;
  }

  const totalQuestions = useMemo(() => questions.length, [questions]);

  async function addManualMCQ() {
    setMsg(null);

    const prompt = mcqPrompt.trim();
    if (!prompt) return setMsg("MCQ prompt is required.");
    if (![optA, optB, optC, optD].every((x) => x.trim().length > 0)) {
      return setMsg("Please fill A, B, C, and D options.");
    }

    setBusy(true);
    const res = await postJson<any>("/api/exam-prep/questions/add", {
      exam_id: examId,
      question: {
        qtype: "mcq",
        prompt,
        options: { A: optA.trim(), B: optB.trim(), C: optC.trim(), D: optD.trim() },
        answer: mcqAnswer,
      },
    });
    setBusy(false);

    if (!res.ok) {
      setMsg((res.data as any)?.error ?? "Failed to add MCQ");
      return;
    }

    setMcqPrompt("");
    setOptA("");
    setOptB("");
    setOptC("");
    setOptD("");
    setMcqAnswer("A");

    await load();
    setMsg("MCQ added ✅");
  }

  async function addManualTheory() {
    setMsg(null);

    const prompt = theoryPrompt.trim();
    if (!prompt) return setMsg("Theory prompt is required.");

    const mg = markingGuide
      .split("\n")
      .map((x) => x.trim())
      .filter(Boolean);

    setBusy(true);
    const res = await postJson<any>("/api/exam-prep/questions/add", {
      exam_id: examId,
      question: {
        qtype: "theory",
        prompt,
        marking_guide: mg.length ? mg : null,
      },
    });
    setBusy(false);

    if (!res.ok) {
      setMsg((res.data as any)?.error ?? "Failed to add theory question");
      return;
    }

    setTheoryPrompt("");
    setMarkingGuide("");

    await load();
    setMsg("Theory question added ✅");
  }

  async function previewPaste() {
    setMsg(null);
    if (!rawText.trim()) return setMsg("Paste something first.");

    setBusy(true);
    const res = await postJson<any>("/api/exam-prep/questions/import", {
      exam_id: examId,
      raw_text: rawText,
      dry_run: true,
    });
    setBusy(false);

    if (!res.ok) {
      setMsg((res.data as any)?.error ?? "Could not preview paste");
      return;
    }

    setPastePreview((res.data as any)?.preview ?? null);
    setMsg(`Preview ready ✅ (${(res.data as any)?.parsed_count ?? 0} detected)`);
  }

  async function importPaste() {
    setMsg(null);
    if (!rawText.trim()) return setMsg("Paste something first.");

    setBusy(true);
    const res = await postJson<any>("/api/exam-prep/questions/import", {
      exam_id: examId,
      raw_text: rawText,
      dry_run: false,
    });
    setBusy(false);

    if (!res.ok) {
      setMsg((res.data as any)?.error ?? "Import failed");
      return;
    }

    setRawText("");
    setPastePreview(null);

    await load();
    setMsg(`Imported ✅ (${(res.data as any)?.imported ?? 0} questions)`);
  }

  function printPaper() {
    // window.print is safe only on client
    window.print();
  }

  const paperHeader = (
    <div className="text-center">
      <div className="text-xs font-semibold uppercase tracking-wide text-slate-700">
        {String(examType).toUpperCase()} / NECO PRACTICE PAPER
      </div>
      <div className="mt-2 text-xl font-bold text-slate-900">{subject}</div>
      <div className="mt-1 text-sm text-slate-700">{title}</div>
      <div className="mt-2 text-xs text-slate-500">
        Class: {grade} • Time Allowed: {durationMins} mins • Total: {totalQuestions} questions
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Print styles */}
      <style jsx global>{`
        @media print {
          body * {
            visibility: hidden;
          }
          #${PAPER_ID},
          #${PAPER_ID} * {
            visibility: visible;
          }
          #${PAPER_ID} {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
            background: white !important;
            padding: 24px !important;
          }
        }
      `}</style>

      {/* Top bar */}
      <header className="sticky top-0 z-10 border-b border-slate-200 bg-white/85 backdrop-blur">
        <div className="mx-auto flex w-full max-w-7xl items-center justify-between gap-3 px-6 py-4">
          <div className="flex items-center gap-3">
            <Link href="/exam-prep" className="text-sm font-semibold text-slate-700 hover:text-slate-900">
              ← Exam Builder
            </Link>
            <span className="hidden sm:inline text-xs text-slate-500">/</span>
            <span className="hidden sm:inline text-xs text-slate-500 truncate max-w-[42ch]">{title || "Untitled"}</span>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setTeacherMode((v) => !v)}
              className={clsx(
                "rounded-xl px-4 py-2 text-sm font-semibold border transition",
                teacherMode
                  ? "bg-emerald-600 text-white border-emerald-600 hover:bg-emerald-700"
                  : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50"
              )}
            >
              {teacherMode ? "Teacher Mode ON" : "Teacher Mode"}
            </button>

            <button
              type="button"
              onClick={printPaper}
              className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold hover:bg-slate-50"
            >
              Print
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-7xl px-6 py-8 grid grid-cols-1 xl:grid-cols-[420px_1fr] gap-8 items-start">
        {/* Left panel: Meta + Tabs */}
        <section className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm xl:sticky xl:top-24">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="text-sm font-semibold text-slate-900">Exam Editor</div>
              <div className="mt-1 text-xs text-slate-500">Auto-saves meta • Manual + Paste questions • Print-ready</div>
            </div>
            <div className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-700">
              {totalQuestions}Q
            </div>
          </div>

          {msg && (
            <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
              {msg}
            </div>
          )}

          {loading ? (
            <div className="mt-6 text-sm text-slate-600">Loading…</div>
          ) : (
            <>
              {/* Meta */}
              <div className="mt-6 grid gap-4">
                <div>
                  <label className="text-sm font-medium text-slate-700">Title</label>
                  <input
                    className="mt-1 w-full rounded-2xl border border-slate-200 px-3 py-3"
                    value={title}
                    onChange={(e) => {
                      setTitle(e.target.value);
                      markDirty();
                    }}
                    placeholder="e.g., SS3 Mathematics Revision Test"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-sm font-medium text-slate-700">Exam Type</label>
                    <select
                      className="mt-1 w-full rounded-2xl border border-slate-200 px-3 py-3 bg-white"
                      value={examType}
                      onChange={(e) => {
                        setExamType(e.target.value as ExamType);
                        markDirty();
                      }}
                    >
                      <option value="waec">WAEC</option>
                      <option value="neco">NECO</option>
                    </select>
                  </div>

                  <div>
                    <label className="text-sm font-medium text-slate-700">Duration (mins)</label>
                    <input
                      type="number"
                      min={10}
                      max={180}
                      className="mt-1 w-full rounded-2xl border border-slate-200 px-3 py-3"
                      value={durationMins}
                      onChange={(e) => {
                        setDurationMins(Number(e.target.value));
                        markDirty();
                      }}
                    />
                  </div>
                </div>

                <div>
                  <label className="text-sm font-medium text-slate-700">Subject</label>
                  <select
                    className="mt-1 w-full rounded-2xl border border-slate-200 px-3 py-3 bg-white"
                    value={subject}
                    onChange={(e) => {
                      setSubject(e.target.value as any);
                      markDirty();
                    }}
                  >
                    {SUBJECTS.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-sm font-medium text-slate-700">Class / Level</label>
                  <input
                    className="mt-1 w-full rounded-2xl border border-slate-200 px-3 py-3"
                    value={grade}
                    onChange={(e) => {
                      setGrade(e.target.value);
                      markDirty();
                    }}
                    placeholder="SS3"
                  />
                </div>
              </div>

              {/* Tabs */}
              <div className="mt-6 flex gap-2">
                {[
                  { key: "manual", label: "Manual" },
                  { key: "paste", label: "Paste" },
                  { key: "preview", label: "Preview" },
                ].map((t) => (
                  <button
                    key={t.key}
                    type="button"
                    onClick={() => setTab(t.key as any)}
                    className={clsx(
                      "rounded-full px-3 py-1 text-xs font-semibold border transition",
                      tab === t.key
                        ? "bg-slate-900 text-white border-slate-900"
                        : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50"
                    )}
                  >
                    {t.label}
                  </button>
                ))}
              </div>

              {/* Manual */}
              {tab === "manual" && (
                <div className="mt-5 grid gap-6">
                  {/* MCQ */}
                  <div className="rounded-2xl border border-slate-200 p-4">
                    <div className="text-sm font-semibold text-slate-900">Add MCQ</div>
                    <div className="mt-3 grid gap-3">
                      <textarea
                        value={mcqPrompt}
                        onChange={(e) => setMcqPrompt(e.target.value)}
                        className="w-full min-h-[90px] rounded-2xl border border-slate-200 px-3 py-3"
                        placeholder="Question prompt…"
                      />
                      <div className="grid grid-cols-2 gap-3">
                        <input
                          value={optA}
                          onChange={(e) => setOptA(e.target.value)}
                          className="rounded-2xl border border-slate-200 px-3 py-3"
                          placeholder="A. option"
                        />
                        <input
                          value={optB}
                          onChange={(e) => setOptB(e.target.value)}
                          className="rounded-2xl border border-slate-200 px-3 py-3"
                          placeholder="B. option"
                        />
                        <input
                          value={optC}
                          onChange={(e) => setOptC(e.target.value)}
                          className="rounded-2xl border border-slate-200 px-3 py-3"
                          placeholder="C. option"
                        />
                        <input
                          value={optD}
                          onChange={(e) => setOptD(e.target.value)}
                          className="rounded-2xl border border-slate-200 px-3 py-3"
                          placeholder="D. option"
                        />
                      </div>

                      <div className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-semibold text-slate-600">Correct:</span>
                          <select
                            value={mcqAnswer}
                            onChange={(e) => setMcqAnswer(e.target.value as any)}
                            className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm"
                          >
                            <option value="A">A</option>
                            <option value="B">B</option>
                            <option value="C">C</option>
                            <option value="D">D</option>
                          </select>
                        </div>

                        <button
                          type="button"
                          onClick={addManualMCQ}
                          disabled={busy}
                          className="rounded-xl bg-slate-900 text-white px-4 py-2 text-sm font-semibold hover:bg-slate-800 disabled:opacity-60"
                        >
                          {busy ? "Adding…" : "Add MCQ"}
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* THEORY */}
                  <div className="rounded-2xl border border-slate-200 p-4">
                    <div className="text-sm font-semibold text-slate-900">Add Theory</div>
                    <div className="mt-3 grid gap-3">
                      <textarea
                        value={theoryPrompt}
                        onChange={(e) => setTheoryPrompt(e.target.value)}
                        className="w-full min-h-[90px] rounded-2xl border border-slate-200 px-3 py-3"
                        placeholder="Theory question prompt… (You can include a) b) c) in the text if you want)"
                      />

                      <textarea
                        value={markingGuide}
                        onChange={(e) => setMarkingGuide(e.target.value)}
                        className="w-full min-h-[90px] rounded-2xl border border-slate-200 px-3 py-3"
                        placeholder="Marking guide (optional) — one point per line"
                      />

                      <div className="flex justify-end">
                        <button
                          type="button"
                          onClick={addManualTheory}
                          disabled={busy}
                          className="rounded-xl bg-slate-900 text-white px-4 py-2 text-sm font-semibold hover:bg-slate-800 disabled:opacity-60"
                        >
                          {busy ? "Adding…" : "Add Theory"}
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Paste */}
              {tab === "paste" && (
                <div className="mt-5 grid gap-4">
                  <div className="rounded-2xl border border-slate-200 p-4">
                    <div className="text-sm font-semibold text-slate-900">Bulk Paste</div>
                    <div className="mt-1 text-xs text-slate-500">
                      Tip: Number your questions like <b>1.</b> <b>2.</b> <b>3.</b> and include options as A-D lines.
                    </div>

                    <textarea
                      value={rawText}
                      onChange={(e) => setRawText(e.target.value)}
                      className="mt-3 w-full min-h-[220px] rounded-2xl border border-slate-200 px-3 py-3 font-mono text-sm"
                      placeholder={`Example:

1. What is the capital of Nigeria?
A. Lagos
B. Abuja
C. Kano
D. Ibadan

2. Explain two causes of inflation.`}
                    />

                    <div className="mt-3 flex gap-2">
                      <button
                        type="button"
                        onClick={previewPaste}
                        disabled={busy}
                        className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold hover:bg-slate-50 disabled:opacity-60"
                      >
                        {busy ? "Working…" : "Preview"}
                      </button>

                      <button
                        type="button"
                        onClick={importPaste}
                        disabled={busy}
                        className="rounded-xl bg-slate-900 text-white px-4 py-2 text-sm font-semibold hover:bg-slate-800 disabled:opacity-60"
                      >
                        {busy ? "Importing…" : "Import into exam"}
                      </button>
                    </div>
                  </div>

                  {pastePreview && (
                    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                      <div className="text-sm font-semibold text-slate-900">Preview (first 10)</div>
                      <div className="mt-3 space-y-3 text-sm text-slate-800">
                        {pastePreview.map((q, i) => (
                          <div key={i} className="rounded-xl border border-slate-200 bg-white p-3">
                            <div className="font-semibold">
                              {i + 1}. {q.prompt}
                            </div>
                            {q.qtype === "mcq" && q.options && (
                              <div className="mt-2 grid sm:grid-cols-2 gap-2">
                                {(["A", "B", "C", "D"] as const).map((k) => (
                                  <div key={k} className="rounded-lg border border-slate-200 px-3 py-2">
                                    <span className="font-semibold">{k}.</span> {q.options?.[k]}
                                  </div>
                                ))}
                              </div>
                            )}
                            {q.qtype === "theory" && (
                              <div className="mt-2 text-xs text-slate-500">Theory question</div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Preview */}
              {tab === "preview" && (
                <div className="mt-5 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
                  <div className="font-semibold text-slate-900">Preview</div>
                  <div className="mt-1">
                    Use the big preview on the right. Click <b>Print</b> in the header to print only the paper.
                  </div>
                </div>
              )}
            </>
          )}
        </section>

        {/* Right panel: Paper + Question list */}
        <section className="w-full space-y-6">
          {/* Paper */}
          <div className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="text-sm font-semibold text-slate-900">Print-ready Paper</div>
                <div className="text-xs text-slate-500 mt-1">This section prints exactly like WAEC-style practice paper.</div>
              </div>
              <button
                type="button"
                onClick={printPaper}
                className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold hover:bg-slate-50"
              >
                Print
              </button>
            </div>

            <div id={PAPER_ID} className="mt-5 w-full max-w-none rounded-[2rem] border border-slate-200 bg-white p-10">
              {paperHeader}

              <hr className="my-5 border-slate-200" />

              <div className="text-sm text-slate-700">
                <div className="font-semibold text-slate-900">Instructions:</div>
                <ul className="list-disc pl-6 mt-2 space-y-1">
                  <li>Answer all objective questions by choosing the correct option A–D.</li>
                  <li>Answer theory/essay questions clearly and write in full sentences where required.</li>
                  <li>Show workings for calculation questions.</li>
                </ul>
              </div>

              <hr className="my-5 border-slate-200" />

              {loading ? (
                <div className="text-sm text-slate-600">Loading questions…</div>
              ) : questions.length === 0 ? (
                <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
                  No questions yet. Add questions using <b>Manual</b> or <b>Paste</b>.
                </div>
              ) : (
                <div className="space-y-6">
                  {questions.map((q, idx) => {
                    const qNo = idx + 1;
                    const qtype = String(q.qtype ?? q.type ?? "").toLowerCase() as QType;
                    const prompt = String(q.prompt ?? "");
                    const options = normalizeOptions(q.options ?? q.choices);
                    const isMcq = qtype === "mcq" && !!options;

                    const answer = q.answer ?? null;
                    const guide = q.marking_guide ?? q.markingGuide ?? null;

                    return (
                      <div key={q.id ?? qNo} className="text-sm text-slate-800">
                        <div className="font-semibold text-slate-900">
                          {qNo}. {prompt}
                        </div>

                        {isMcq && (
                          <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-3">
                            {(["A", "B", "C", "D"] as const).map((k) => (
                              <div key={k} className="rounded-xl border border-slate-200 px-4 py-3">
                                <span className="font-semibold">{k}.</span> {options?.[k]}
                              </div>
                            ))}
                          </div>
                        )}

                        {!isMcq && (
                          <div className="mt-2 text-slate-700">
                            <span className="italic text-slate-500">Answer:</span>{" "}
                            ________________________________________________
                          </div>
                        )}

                        {teacherMode && isMcq && answer && (
                          <div className="mt-2 text-xs rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-emerald-900">
                            Correct Answer: <b>{answer}</b>
                          </div>
                        )}

                        {teacherMode && !isMcq && Array.isArray(guide) && guide.length > 0 && (
                          <div className="mt-3 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-xs text-emerald-900">
                            <div className="font-semibold mb-1">Marking Guide</div>
                            <ul className="list-disc pl-5">
                              {guide.map((g: string, i: number) => (
                                <li key={i}>{g}</li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Quick list */}
          <div className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-sm font-semibold text-slate-900">Questions ({totalQuestions})</div>
                <div className="text-xs text-slate-500 mt-1">This is your saved question list (auto-updates after add/import).</div>
              </div>
              <button
                type="button"
                onClick={load}
                className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold hover:bg-slate-50"
              >
                Refresh
              </button>
            </div>

            <div className="mt-4 space-y-2">
              {questions.length === 0 ? (
                <div className="text-sm text-slate-600">No questions yet.</div>
              ) : (
                questions.slice(0, 20).map((q, i) => (
                  <div key={q.id ?? i} className="rounded-xl border border-slate-200 p-3">
                    <div className="text-xs text-slate-500">{String(q.qtype ?? q.type ?? "").toUpperCase()}</div>
                    <div className="text-sm font-semibold text-slate-900 line-clamp-2">
                      {i + 1}. {String(q.prompt ?? "")}
                    </div>
                  </div>
                ))
              )}
              {questions.length > 20 && (
                <div className="text-xs text-slate-500">Showing first 20 here — full list is in the paper preview above.</div>
              )}
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}