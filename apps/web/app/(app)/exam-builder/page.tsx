"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { createBrowserSupabase } from "@/lib/supabase/browser";

import ExamBuilderForm from "@/components/exam-builder/ExamBuilderForm";
import ExamList from "@/components/exam-builder/ExamList";
import ExamPaperPreview from "@/components/exam-builder/ExamPaperPreview";
import type { ExamBuilderInput, ExamRecord } from "@/lib/exams/types";

type ExamListItem = {
  id: string;
  exam_title: string;
  subject: string;
  class_or_grade: string;
  exam_type: string;
  exam_alignment: string;
  objective_question_count: number;
  theory_question_count: number;
  duration_mins: number;
  total_marks: number;
  created_at: string;
};

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

function normalizeListResponse(json: unknown): ExamListItem[] {
  const root = (json ?? {}) as Record<string, unknown>;
  if (root.ok === false) return [];
  const payload = root.data;
  if (Array.isArray(payload)) return payload as ExamListItem[];
  if (Array.isArray(json)) return json as ExamListItem[];
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
  const [error, setError] = useState<string | null>(null);
  const [teacherMode, setTeacherMode] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [items, setItems] = useState<ExamListItem[]>([]);
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
        </section>
      </div>
    </div>
  );
}