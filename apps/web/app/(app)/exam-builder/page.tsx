"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { createBrowserSupabase } from "@/lib/supabase/browser";

import ExamBuilderForm from "@/components/exam-builder/ExamBuilderForm";
import ExamList from "@/components/exam-builder/ExamList";
import ExamPaperPreview from "@/components/exam-builder/ExamPaperPreview";
import ExamSectionEditor from "@/components/exam-builder/ExamSectionEditor";
import type { ExamBuilderInput, ExamListRow, ExamRecord, ExamResult } from "@/lib/exams/types";

function getErrorMessage(error: unknown, fallback: string) {
  if (error && typeof error === "object" && "message" in error) {
    return String((error as { message?: unknown }).message ?? fallback);
  }
  return fallback;
}

function normalizeRecordResponse(json: unknown): ExamRecord | null {
  const root = (json ?? {}) as Record<string, unknown>;
  if (root.ok === false) return null;
  const payload = (root.data ?? root) as Record<string, unknown>;
  if (!payload || typeof payload !== "object") return null;
  return payload as unknown as ExamRecord;
}

function normalizeListResponse(json: unknown): ExamListRow[] {
  const root = (json ?? {}) as Record<string, unknown>;
  if (root.ok === false) return [];
  const payload = root.data;
  if (Array.isArray(payload)) return payload as ExamListRow[];
  if (Array.isArray(json)) return json as ExamListRow[];
  return [];
}

function defaultInput(): ExamBuilderInput {
  return {
    subject: "Mathematics",
    topicOrCoverage: "Algebra and Linear Equations",
    classOrGrade: "SS2",
    schoolLevel: "Senior Secondary",
    curriculum: "Nigerian Curriculum",
    examAlignment: "None",
    examType: "Class Test",
    durationMins: 90,
    totalMarks: 40,
    objectiveQuestionCount: 20,
    theoryQuestionCount: 3,
    difficultyLevel: "Medium",
    instructions: ["Answer all objective questions.", "Answer all theory questions clearly."],
    specialNotes: null,
    schoolName: null,
    examTitleOverride: null,
  };
}

export default function ExamBuilderPage() {
  const searchParams = useSearchParams();
  const [form, setForm] = useState<ExamBuilderInput>(defaultInput);
  const [loading, setLoading] = useState(false);
  const [listLoading, setListLoading] = useState(false);
  const [savingEdit, setSavingEdit] = useState(false);
  const [downloadingPdf, setDownloadingPdf] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [teacherMode, setTeacherMode] = useState(false);
  const [showEditor, setShowEditor] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [items, setItems] = useState<ExamListRow[]>([]);
  const [active, setActive] = useState<ExamRecord | null>(null);

  const supabase = useMemo(() => createBrowserSupabase(), []);

  async function getToken() {
    const { data } = await supabase.auth.getSession();
    return data.session?.access_token ?? "";
  }

  async function loadList() {
    setListLoading(true);
    setError(null);
    try {
      const token = await getToken();
      if (!token) throw new Error("Not logged in");
      const res = await fetch("/api/exams", {
        headers: { Authorization: `Bearer ${token}` },
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error((json as { error?: string }).error ?? "Failed to load exams");
      }
      setItems(normalizeListResponse(json));
    } catch (e: unknown) {
      setError(getErrorMessage(e, "Failed to load exams"));
      setItems([]);
    } finally {
      setListLoading(false);
    }
  }

  async function openExam(id: string) {
    setError(null);
    setSelectedId(id);
    try {
      const token = await getToken();
      if (!token) throw new Error("Not logged in");
      const res = await fetch(`/api/exams?id=${encodeURIComponent(id)}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error((json as { error?: string }).error ?? "Failed to open exam");
      }
      const record = normalizeRecordResponse(json);
      if (!record) throw new Error("Exam response was empty");
      setActive(record);
    } catch (e: unknown) {
      setError(getErrorMessage(e, "Failed to open exam"));
    }
  }

  async function generateExam() {
    setLoading(true);
    setError(null);
    try {
      const token = await getToken();
      if (!token) throw new Error("Not logged in");
      const res = await fetch("/api/exams", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(form),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error((json as { error?: string }).error ?? "Failed to generate exam");
      }
      const record = normalizeRecordResponse(json);
      if (!record) throw new Error("Generated exam response was empty");
      setActive(record);
      setSelectedId(record.id);
      await loadList();
    } catch (e: unknown) {
      setError(getErrorMessage(e, "Failed to generate exam"));
    } finally {
      setLoading(false);
    }
  }

  async function deleteExam(id: string) {
    const confirmed = window.confirm("Delete this saved exam?");
    if (!confirmed) return;
    setError(null);
    try {
      const token = await getToken();
      if (!token) throw new Error("Not logged in");
      const res = await fetch(`/api/exams?id=${encodeURIComponent(id)}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error((json as { error?: string }).error ?? "Delete failed");
      }
      setItems((prev) => prev.filter((item) => item.id !== id));
      if (active?.id === id) {
        setActive(null);
        setSelectedId(null);
      }
    } catch (e: unknown) {
      setError(getErrorMessage(e, "Delete failed"));
    }
  }

  async function reuseExam(id: string) {
    setError(null);
    try {
      const token = await getToken();
      if (!token) throw new Error("Not logged in");
      const res = await fetch("/api/exams", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ action: "reuse", sourceExamId: id }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error((json as { error?: string }).error ?? "Failed to reuse exam");
      }
      const record = normalizeRecordResponse(json);
      if (!record) throw new Error("Reused exam response was empty");
      setActive(record);
      setSelectedId(record.id);
      setShowEditor(false);
      await loadList();
    } catch (e: unknown) {
      setError(getErrorMessage(e, "Failed to reuse exam"));
    }
  }

  async function saveSectionEdits(nextResult: ExamResult) {
    if (!active?.id) return;
    setSavingEdit(true);
    setError(null);
    try {
      const token = await getToken();
      if (!token) throw new Error("Not logged in");
      const res = await fetch("/api/exams", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          id: active.id,
          examTitle: nextResult.examTitle,
          schoolName: nextResult.schoolName,
          instructions: nextResult.instructions,
          resultJson: nextResult,
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error((json as { error?: string }).error ?? "Failed to save exam edits");
      }
      const record = normalizeRecordResponse(json);
      if (!record) throw new Error("Save response was empty");
      setActive(record);
      setShowEditor(false);
      await loadList();
    } catch (e: unknown) {
      setError(getErrorMessage(e, "Failed to save exam edits"));
    } finally {
      setSavingEdit(false);
    }
  }

  async function downloadPdf() {
    if (!active?.id) return;
    setDownloadingPdf(true);
    setError(null);
    try {
      const token = await getToken();
      if (!token) throw new Error("Not logged in");
      const res = await fetch(
        `/api/exams/export/pdf?id=${encodeURIComponent(active.id)}&mode=${
          teacherMode ? "teacher" : "student"
        }`,
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        throw new Error((json as { error?: string }).error ?? "PDF export failed");
      }

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${active.exam_title}-${teacherMode ? "teacher" : "student"}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (e: unknown) {
      setError(getErrorMessage(e, "PDF export failed"));
    } finally {
      setDownloadingPdf(false);
    }
  }

  useEffect(() => {
    loadList();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const examId = searchParams.get("examId");
    if (!examId) return;
    void openExam(examId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  return (
    <div className="space-y-5">
      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <h1 className="text-2xl font-bold text-slate-900">Exam Builder</h1>
        <p className="mt-1 text-sm text-slate-600">
          Dedicated formal assessment generator for structured, printable school exams.
        </p>
      </div>

      {error ? (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div>
      ) : null}

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-[1.05fr_0.95fr]">
        <div className="space-y-5">
          <ExamBuilderForm value={form} loading={loading} onChange={setForm} onSubmit={generateExam} />
          <ExamList
            loading={listLoading}
            items={items}
            selectedId={selectedId}
            onOpen={openExam}
            onReuse={reuseExam}
            onDelete={deleteExam}
            onRefresh={loadList}
          />
        </div>

        <section className="space-y-3">
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-base font-bold text-slate-900">Exam Paper Preview</h2>
                <p className="text-xs text-slate-600">
                  Printable formal paper layout with objective, theory, and marking guide.
                </p>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => setTeacherMode((v) => !v)}
                  className={`rounded-xl px-3 py-2 text-xs font-semibold ${
                    teacherMode
                      ? "bg-emerald-600 text-white hover:bg-emerald-700"
                      : "border border-slate-200 bg-white text-slate-800 hover:bg-slate-50"
                  }`}
                >
                  {teacherMode ? "Teacher Copy ON" : "Teacher Copy"}
                </button>
                <button
                  onClick={() => window.print()}
                  className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-800 hover:bg-slate-50"
                >
                  Print
                </button>
                <button
                  onClick={downloadPdf}
                  disabled={!active || downloadingPdf}
                  className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-800 hover:bg-slate-50 disabled:opacity-60"
                >
                  {downloadingPdf ? "Downloading..." : "Download PDF"}
                </button>
                <button
                  onClick={() => setShowEditor((v) => !v)}
                  disabled={!active}
                  className="rounded-xl border border-violet-200 bg-violet-50 px-3 py-2 text-xs font-semibold text-violet-700 hover:bg-violet-100 disabled:opacity-60"
                >
                  {showEditor ? "Close Editor" : "Edit Sections"}
                </button>
              </div>
            </div>
          </div>

          {!active ? (
            <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-6 text-sm text-slate-600">
              Empty state: generate a new exam or open one from your saved exams to see the full paper preview
              and marking guide.
            </div>
          ) : null}

          <ExamPaperPreview exam={active} teacherMode={teacherMode} />

          {active?.result_json && showEditor ? (
            <ExamSectionEditor
              result={active.result_json}
              onSave={saveSectionEdits}
              saving={savingEdit}
            />
          ) : null}
        </section>
      </div>
    </div>
  );
}