"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { createBrowserSupabase } from "@/lib/supabase/browser";
import { getInvalidJsonMessage, readJsonResponse } from "@/lib/http/safe-json";
import { track } from "@/lib/analytics";

import ExamBuilderForm from "@/components/exam-builder/ExamBuilderForm";
import ExamList from "@/components/exam-builder/ExamList";
import type { ExamBuilderInput, ExamListRow, ExamRecord, ExamResult } from "@/lib/exams/types";

const EXAM_PRINT_ID = "lessonforge-exam-print";

function optionLabel(index: number) {
  return (["A", "B", "C", "D"][index] ?? "A") as "A" | "B" | "C" | "D";
}

function optionIndexFromLabel(value: string): 0 | 1 | 2 | 3 {
  const up = value.trim().toUpperCase();
  if (up === "B") return 1;
  if (up === "C") return 2;
  if (up === "D") return 3;
  return 0;
}

function cloneResult(result: ExamResult): ExamResult {
  return JSON.parse(JSON.stringify(result)) as ExamResult;
}

function sanitizeFileName(value: string) {
  return value.replace(/[^a-z0-9_-]+/gi, "_").replace(/^_+|_+$/g, "") || "Exam";
}

function recalculateExamResult(result: ExamResult, preserveTotalMarks = false): ExamResult {
  const objectiveMarks = result.objectiveSection.questions.reduce((sum, q) => sum + q.marks, 0);
  const theoryMarks = result.theorySection.questions.reduce(
    (sum, q) => sum + q.subQuestions.reduce((ss, sub) => ss + sub.marks, 0),
    0
  );
  const totalMarks = preserveTotalMarks ? result.totalMarks : objectiveMarks + theoryMarks;

  return {
    ...result,
    totalMarks,
    printableHeader: {
      ...result.printableHeader,
      schoolName: result.schoolName,
      examTitle: result.examTitle,
      subject: result.subject,
      classOrGrade: result.classOrGrade,
      durationLabel: result.duration.label,
      totalMarks,
    },
    sections: {
      objective: {
        ...result.sections.objective,
        questionCount: result.objectiveSection.questions.length,
        marks: objectiveMarks,
      },
      theory: {
        ...result.sections.theory,
        questionCount: result.theorySection.questions.length,
        marks: theoryMarks,
      },
    },
    markingGuide: {
      ...result.markingGuide,
      objectiveAnswerKey: result.objectiveSection.questions.map((q) => ({
        questionNumber: q.number,
        answerLabel: optionLabel(q.correctOptionIndex),
        marks: q.marks,
      })),
      theoryGuide: result.theorySection.questions.map((q) => ({
        mainQuestionNumber: q.mainQuestionNumber,
        totalMarks: q.subQuestions.reduce((sum, sub) => sum + sub.marks, 0),
        subQuestions: q.subQuestions.map((sub) => ({
          label: sub.label,
          marks: sub.marks,
          suggestedAnswer: sub.suggestedAnswer,
          markingPoints: sub.markingPoints,
        })),
      })),
      totals: {
        objectiveMarks,
        theoryMarks,
        overall: totalMarks,
      },
    },
  };
}

function getErrorMessage(error: unknown, fallback: string) {
  if (error instanceof DOMException && error.name === "AbortError") {
    return "The request timed out before the generation finished. Please try again.";
  }
  if (error && typeof error === "object" && "message" in error) {
    return String((error as { message?: unknown }).message ?? fallback);
  }
  return fallback;
}

function getApiError(json: unknown, fallback: string) {
  const payload = (json ?? {}) as { error?: unknown; message?: unknown };
  const message = typeof payload.message === "string" ? payload.message.trim() : "";
  const error = typeof payload.error === "string" ? payload.error.trim() : "";
  return message || error || fallback;
}

function needsPersonalCreditConfirmation(json: unknown) {
  const payload = (json ?? {}) as { errorCode?: unknown };
  return payload.errorCode === "needs_personal_confirmation";
}

async function readApiJson(response: Response) {
  const parsed = await readJsonResponse(response);
  if (parsed.parseError) {
    throw new Error(getInvalidJsonMessage(response));
  }
  return parsed.data ?? {};
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
  const [downloadingDocx, setDownloadingDocx] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [teacherMode, setTeacherMode] = useState(false);
  const [showEditor, setShowEditor] = useState(false);
  const [expandedPreview, setExpandedPreview] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [items, setItems] = useState<ExamListRow[]>([]);
  const [active, setActive] = useState<ExamRecord | null>(null);
  const [draftResult, setDraftResult] = useState<ExamResult | null>(null);

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
      const json = await readApiJson(res);
      if (!res.ok) {
        throw new Error(getApiError(json, "Failed to load exams"));
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
      const json = await readApiJson(res);
      if (!res.ok) {
        throw new Error(getApiError(json, "Failed to open exam"));
      }
      const record = normalizeRecordResponse(json);
      if (!record) throw new Error("Exam response was empty");
      setActive(record);
      setDraftResult(record.result_json ? cloneResult(record.result_json) : null);
      setShowEditor(false);
      track("library_item_opened", {
        user_role: "teacher",
        active_role: "teacher",
        subject: record.subject,
        school_level: record.school_level,
        curriculum: record.curriculum,
        generation_type: "exam",
      });
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
      let res = await fetch("/api/exams", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(form),
      });
      let json = await readApiJson(res);
      let creditSource: "personal" | "school" | undefined;
      if (!res.ok && res.status === 402 && needsPersonalCreditConfirmation(json)) {
        const payload = json as { cost?: unknown; personalCreditsAvailable?: unknown };
        const cost = typeof payload.cost === "number" ? payload.cost : 1;
        const personalCreditsAvailable =
          typeof payload.personalCreditsAvailable === "number"
            ? payload.personalCreditsAvailable
            : "available";
        const confirmed = window.confirm(
          `Your school has run out of credits.\n\nUse your personal credits instead?\n\nThis will use ${cost} of your ${personalCreditsAvailable} personal credits.`
        );

        if (!confirmed) {
          throw new Error("Generation cancelled.");
        }

        res = await fetch("/api/exams", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ ...form, usePersonalCredits: true }),
        });
        creditSource = "personal";
        json = await readApiJson(res);
      }
      if (!res.ok) {
        throw new Error(getApiError(json, "Failed to generate exam"));
      }
      const record = normalizeRecordResponse(json);
      if (!record) throw new Error("Generated exam response was empty");
      setActive(record);
      setDraftResult(record.result_json ? cloneResult(record.result_json) : null);
      setShowEditor(false);
      setSelectedId(record.id);
      track("exam_generated", {
        user_role: "teacher",
        active_role: "teacher",
        credit_source: creditSource,
        credits_cost: 1,
        subject: form.subject,
        school_level: form.schoolLevel,
        curriculum: form.curriculum,
        generation_type: "exam",
      });
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
      const json = await readApiJson(res);
      if (!res.ok) {
        throw new Error(getApiError(json, "Delete failed"));
      }
      setItems((prev) => prev.filter((item) => item.id !== id));
      if (active?.id === id) {
        setActive(null);
        setDraftResult(null);
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
      const json = await readApiJson(res);
      if (!res.ok) {
        throw new Error(getApiError(json, "Failed to reuse exam"));
      }
      const record = normalizeRecordResponse(json);
      if (!record) throw new Error("Reused exam response was empty");
      setActive(record);
      setDraftResult(record.result_json ? cloneResult(record.result_json) : null);
      setSelectedId(record.id);
      track("library_item_opened", {
        user_role: "teacher",
        active_role: "teacher",
        subject: record.subject,
        school_level: record.school_level,
        curriculum: record.curriculum,
        generation_type: "exam",
      });
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
      const json = await readApiJson(res);
      if (!res.ok) {
        throw new Error(getApiError(json, "Failed to save exam edits"));
      }
      const record = normalizeRecordResponse(json);
      if (!record) throw new Error("Save response was empty");
      setActive(record);
      setDraftResult(record.result_json ? cloneResult(record.result_json) : null);
      setShowEditor(false);
      await loadList();
    } catch (e: unknown) {
      setError(getErrorMessage(e, "Failed to save exam edits"));
    } finally {
      setSavingEdit(false);
    }
  }

  async function downloadWord() {
    const result = draftResult ?? active?.result_json;
    if (!active || !result) return;
    setDownloadingDocx(true);
    setError(null);
    try {
      const {
        AlignmentType,
        Document,
        HeadingLevel,
        Packer,
        Paragraph,
        TextRun,
      } = await import("docx");
      const normal = (text: string, bold = false) => new TextRun({ text, bold, size: 22 });
      const small = (text: string, bold = false) => new TextRun({ text, bold, size: 20 });
      const heading = (text: string) =>
        new Paragraph({
          text,
          heading: HeadingLevel.HEADING_2,
          spacing: { before: 280, after: 120 },
        });
      const line = (text: string, bold = false) =>
        new Paragraph({ children: [normal(text, bold)], spacing: { after: 90 } });
      const children = [
        new Paragraph({
          children: [new TextRun({ text: result.schoolName || "School Name", bold: true, size: 28 })],
          alignment: AlignmentType.CENTER,
        }),
        new Paragraph({
          children: [new TextRun({ text: result.examTitle, bold: true, size: 32 })],
          alignment: AlignmentType.CENTER,
          spacing: { after: 160 },
        }),
        line(`Subject: ${result.subject}`, true),
        line(`Class: ${result.classOrGrade}`, true),
        line(`Date: ____________________    Duration: ${result.duration.label}    Total Marks: ${result.totalMarks}`, true),
        line("Student Name: ______________________________    Class: ______________    Date: ______________", true),
        heading("General Instructions"),
        ...result.instructions.map((instruction) => line(instruction)),
        heading(`${result.sections.objective.title} (${result.sections.objective.marks} marks)`),
        ...result.objectiveSection.questions.flatMap((q) => [
          line(`${q.number}. ${q.questionText}`),
          ...q.options.map((option, idx) => line(`   ${optionLabel(idx)}. ${option}`)),
          ...(teacherMode ? [line(`   Correct Answer: ${optionLabel(q.correctOptionIndex)}`, true)] : []),
        ]),
        heading(`${result.sections.theory.title} (${result.sections.theory.marks} marks)`),
        ...result.theorySection.instructions.map((instruction) => line(instruction)),
        ...result.theorySection.questions.flatMap((q) => [
          line(`${q.mainQuestionNumber}. ${q.mainQuestionText} (${q.totalMarks} marks)`, true),
          ...q.subQuestions.map((sub) => line(`   (${sub.label}) ${sub.questionText} (${sub.marks} marks)`)),
        ]),
      ];

      const rawEssaySection = (result as unknown as { essaySection?: unknown }).essaySection;
      if (rawEssaySection && typeof rawEssaySection === "object") {
        const essay = rawEssaySection as { title?: unknown; questions?: unknown[]; instructions?: unknown[] };
        const questions = Array.isArray(essay.questions) ? essay.questions : [];
        if (questions.length) {
          children.push(heading(String(essay.title || "Essay Section")));
          if (Array.isArray(essay.instructions)) {
            for (const instruction of essay.instructions) children.push(line(String(instruction)));
          }
          questions.forEach((item, idx) => {
            const q = item as { questionText?: unknown; question?: unknown; marks?: unknown };
            children.push(
              line(`${idx + 1}. ${String(q.questionText ?? q.question ?? "")}${q.marks ? ` (${q.marks} marks)` : ""}`)
            );
          });
        }
      }

      if (teacherMode) {
        children.push(heading("Marking Guide (Teacher Copy)"));
        children.push(line("Objective Answer Key", true));
        children.push(
          line(
            result.markingGuide.objectiveAnswerKey
              .map((item) => `Q${item.questionNumber}: ${item.answerLabel}`)
              .join("    ")
          )
        );
        children.push(line("Theory Guide", true));
        for (const guide of result.markingGuide.theoryGuide) {
          children.push(line(`Theory Question ${guide.mainQuestionNumber} (${guide.totalMarks} marks)`, true));
          for (const sub of guide.subQuestions) {
            children.push(line(`(${sub.label}) ${sub.marks} marks`, true));
            if (sub.suggestedAnswer) children.push(line(`Suggested answer: ${sub.suggestedAnswer}`));
            for (const point of sub.markingPoints) children.push(line(`- ${point}`));
          }
        }
        children.push(
          new Paragraph({
            children: [
              small(
                `Totals: Objective ${result.markingGuide.totals.objectiveMarks}, Theory ${result.markingGuide.totals.theoryMarks}, Overall ${result.markingGuide.totals.overall}`,
                true
              ),
            ],
            spacing: { before: 180 },
          })
        );
      }

      const doc = new Document({
        sections: [
          {
            properties: { page: { margin: { top: 720, bottom: 720, left: 900, right: 900 } } },
            children,
          },
        ],
      });
      const buffer = await Packer.toBlob(doc);
      const blob = new Blob([buffer], {
        type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${sanitizeFileName(result.subject)}_${sanitizeFileName(result.classOrGrade)}_Exam.docx`;
      document.body.appendChild(a);
      a.click();
      track("export_pdf_clicked", {
        user_role: "teacher",
        active_role: "teacher",
        subject: active.subject,
        school_level: active.school_level,
        curriculum: active.curriculum,
        generation_type: "exam",
      });
      a.remove();
      URL.revokeObjectURL(url);
    } catch (e: unknown) {
      setError(getErrorMessage(e, "Word export failed"));
    } finally {
      setDownloadingDocx(false);
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

  const previewResult = draftResult ?? active?.result_json ?? null;

  function updateDraft(updater: (next: ExamResult) => void, preserveTotalMarks = false) {
    setDraftResult((current) => {
      const source = current ?? active?.result_json;
      if (!source) return current;
      const next = cloneResult(source);
      updater(next);
      return recalculateExamResult(next, preserveTotalMarks);
    });
  }

  function startEditing() {
    if (!active?.result_json) return;
    setDraftResult(cloneResult(active.result_json));
    setShowEditor(true);
  }

  function resetDraft() {
    if (!active?.result_json) return;
    setDraftResult(cloneResult(active.result_json));
  }

  async function saveDraft() {
    if (!draftResult) return;
    await saveSectionEdits(draftResult);
  }

  const previewClasses = expandedPreview
    ? "fixed inset-0 z-50 overflow-auto bg-slate-100 p-3 sm:p-6"
    : "w-full";

  return (
    <div className="space-y-5">
      <div className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-4 shadow-sm">
        <h1 className="text-2xl font-bold text-[var(--text-primary)]">Exam Builder</h1>
        <p className="mt-1 text-sm text-[var(--text-secondary)]">
          Dedicated formal assessment generator for structured, printable school exams.
        </p>
      </div>

      {error ? (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div>
      ) : null}

      <div className="flex flex-col gap-5">
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

        <section className={previewClasses}>
          <div className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-4 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-base font-bold text-[var(--text-primary)]">Exam Paper Preview</h2>
                <p className="text-xs text-[var(--text-secondary)]">
                  Printable formal paper layout with objective, theory, and marking guide.
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => setTeacherMode((v) => !v)}
                  className={`min-h-12 rounded-xl px-3 py-2 text-xs font-semibold ${
                    teacherMode
                      ? "bg-emerald-600 text-white hover:bg-emerald-700"
                      : "border border-[var(--border)] bg-[var(--card)] text-[var(--text-primary)] hover:bg-[var(--card-alt)]"
                  }`}
                >
                  {teacherMode ? "Teacher Copy ON" : "Teacher Copy"}
                </button>
                <button
                  onClick={() => window.print()}
                  className="min-h-12 rounded-xl border border-[var(--border)] bg-[var(--card)] px-3 py-2 text-xs font-semibold text-[var(--text-primary)] hover:bg-[var(--card-alt)]"
                >
                  Print
                </button>
                <button
                  onClick={downloadWord}
                  disabled={!active || downloadingDocx}
                  className="min-h-12 rounded-xl border border-[var(--border)] bg-[var(--card)] px-3 py-2 text-xs font-semibold text-[var(--text-primary)] hover:bg-[var(--card-alt)] disabled:opacity-60"
                >
                  {downloadingDocx ? "Downloading..." : "Download Word (.docx)"}
                </button>
                <button
                  onClick={() => (showEditor ? setShowEditor(false) : startEditing())}
                  disabled={!active}
                  className="min-h-12 rounded-xl border border-violet-200 bg-violet-50 px-3 py-2 text-xs font-semibold text-violet-700 hover:bg-violet-100 disabled:opacity-60"
                >
                  {showEditor ? "Close Editor" : "Edit Sections"}
                </button>
                <button
                  onClick={() => setExpandedPreview((v) => !v)}
                  className="min-h-12 rounded-xl border border-[var(--border)] bg-[var(--card)] px-3 py-2 text-xs font-semibold text-[var(--text-primary)] hover:bg-[var(--card-alt)]"
                >
                  {expandedPreview ? "Close Preview" : "Expand Preview"}
                </button>
              </div>
            </div>
          </div>

          {!active ? (
            <div className="rounded-2xl border border-dashed border-slate-300 bg-[var(--card-alt)] p-6 text-sm text-[var(--text-secondary)]">
              Empty state: generate a new exam or open one from your saved exams to see the full paper preview
              and marking guide.
            </div>
          ) : null}

          <style jsx global>{`
            @media print {
              body * {
                visibility: hidden;
              }
              #${EXAM_PRINT_ID},
              #${EXAM_PRINT_ID} * {
                visibility: visible;
              }
              #${EXAM_PRINT_ID} {
                position: absolute;
                left: 0;
                top: 0;
                width: 100%;
                background: #fff !important;
                padding: 20px !important;
              }
            }
          `}</style>

          {showEditor && previewResult ? (
            <div className="sticky top-0 z-10 mt-3 flex flex-wrap items-center gap-2 rounded-2xl border border-violet-200 bg-white/95 p-3 shadow-sm backdrop-blur">
              <button
                onClick={saveDraft}
                disabled={savingEdit}
                className="min-h-12 rounded-xl bg-violet-600 px-4 py-2 text-sm font-semibold text-white hover:bg-violet-700 disabled:opacity-60"
              >
                {savingEdit ? "Saving..." : "Save Changes"}
              </button>
              <button
                onClick={resetDraft}
                className="min-h-12 rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
              >
                Reset to Original
              </button>
              <button
                onClick={() => window.print()}
                className="min-h-12 rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
              >
                Print
              </button>
              <button
                onClick={downloadWord}
                disabled={downloadingDocx}
                className="min-h-12 rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60"
              >
                {downloadingDocx ? "Downloading..." : "Download Word"}
              </button>
            </div>
          ) : null}

          {!previewResult ? (
            <div className="mt-3 min-h-[600px] rounded-2xl border border-slate-200 bg-slate-50 p-6 text-sm text-slate-600">
              No exam selected yet. Generate or open a saved exam to preview the paper.
            </div>
          ) : (
            <article
              id={EXAM_PRINT_ID}
              className="mt-3 min-h-[600px] w-full rounded-2xl border border-slate-200 bg-white p-4 text-sm text-slate-800 shadow-sm sm:p-6"
            >
              <header className="text-center">
                {showEditor ? (
                  <input
                    value={previewResult.schoolName ?? ""}
                    onChange={(e) => updateDraft((next) => (next.schoolName = e.target.value))}
                    placeholder="School name"
                    className="w-full rounded-lg border border-violet-200 px-3 py-2 text-center text-sm font-semibold uppercase text-slate-700"
                  />
                ) : previewResult.schoolName ? (
                  <div className="text-sm font-semibold uppercase text-slate-700">{previewResult.schoolName}</div>
                ) : null}
                {showEditor ? (
                  <input
                    value={previewResult.examTitle}
                    onChange={(e) => updateDraft((next) => (next.examTitle = e.target.value))}
                    className="mt-2 w-full rounded-lg border border-violet-200 px-3 py-2 text-center text-lg font-bold text-slate-900"
                  />
                ) : (
                  <h2 className="mt-1 text-lg font-bold text-slate-900 sm:text-xl">{previewResult.examTitle}</h2>
                )}
                <div className="mt-3 grid grid-cols-1 gap-2 text-left text-sm sm:grid-cols-2 lg:grid-cols-4">
                  {showEditor ? (
                    <>
                      <input value={previewResult.subject} onChange={(e) => updateDraft((next) => (next.subject = e.target.value))} className="rounded-lg border border-violet-200 px-3 py-2" />
                      <input value={previewResult.classOrGrade} onChange={(e) => updateDraft((next) => (next.classOrGrade = e.target.value))} className="rounded-lg border border-violet-200 px-3 py-2" />
                      <input value={previewResult.duration.label} onChange={(e) => updateDraft((next) => (next.duration.label = e.target.value))} className="rounded-lg border border-violet-200 px-3 py-2" />
                      <input
                        type="number"
                        value={previewResult.totalMarks}
                        onChange={(e) =>
                          updateDraft((next) => {
                            next.totalMarks = Number(e.target.value) || 0;
                          }, true)
                        }
                        className="rounded-lg border border-violet-200 px-3 py-2"
                      />
                    </>
                  ) : (
                    <>
                      <div>Subject: {previewResult.subject}</div>
                      <div>Class: {previewResult.classOrGrade}</div>
                      <div>Duration: {previewResult.duration.label}</div>
                      <div>Total Marks: {previewResult.totalMarks}</div>
                    </>
                  )}
                </div>
                <div className="mt-3 grid grid-cols-1 gap-2 text-left text-sm text-slate-700 sm:grid-cols-3">
                  <div className="rounded-lg border border-slate-200 px-3 py-2">Student Name: __________________</div>
                  <div className="rounded-lg border border-slate-200 px-3 py-2">Class: __________________</div>
                  <div className="rounded-lg border border-slate-200 px-3 py-2">Date: __________________</div>
                </div>
              </header>

              <hr className="my-5 border-slate-200" />

              <section>
                <h3 className="text-lg font-semibold text-slate-900">General Instructions</h3>
                <ul className="mt-2 list-disc space-y-2 pl-6 text-sm text-slate-700">
                  {previewResult.instructions.map((line, idx) => (
                    <li key={`instruction-${idx}`}>
                      {showEditor ? (
                        <textarea
                          value={line}
                          onChange={(e) =>
                            updateDraft((next) => {
                              next.instructions[idx] = e.target.value;
                            })
                          }
                          className="min-h-12 w-full rounded-lg border border-violet-200 px-3 py-2"
                        />
                      ) : (
                        line
                      )}
                    </li>
                  ))}
                </ul>
              </section>

              <hr className="my-5 border-slate-200" />

              <section>
                <h3 className="text-lg font-bold text-slate-900">
                  {previewResult.sections.objective.title} ({previewResult.sections.objective.marks} marks)
                </h3>
                <ul className="mt-3 space-y-4">
                  {previewResult.objectiveSection.questions.map((q, qIndex) => (
                    <li key={`obj-${q.number}`} className="text-sm text-slate-800">
                      <div className="font-semibold">{q.number}.</div>
                      {showEditor ? (
                        <textarea
                          value={q.questionText}
                          onChange={(e) =>
                            updateDraft((next) => {
                              next.objectiveSection.questions[qIndex].questionText = e.target.value;
                            })
                          }
                          className="mt-1 min-h-16 w-full rounded-lg border border-violet-200 px-3 py-2"
                        />
                      ) : (
                        <div className="font-semibold">{q.questionText}</div>
                      )}
                      <div className="mt-2 grid gap-2 sm:grid-cols-2">
                        {q.options.map((option, optIndex) => (
                          <div key={`obj-${q.number}-${optIndex}`} className="rounded-xl border border-slate-200 px-3 py-2">
                            <span className="font-semibold">{optionLabel(optIndex)}.</span>{" "}
                            {showEditor ? (
                              <input
                                value={option}
                                onChange={(e) =>
                                  updateDraft((next) => {
                                    next.objectiveSection.questions[qIndex].options[optIndex] = e.target.value;
                                  })
                                }
                                className="mt-1 min-h-12 w-full rounded-lg border border-violet-200 px-2 py-2"
                              />
                            ) : (
                              option
                            )}
                          </div>
                        ))}
                      </div>
                      <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-slate-500">
                        <span>Marks: {q.marks}</span>
                        {showEditor ? (
                          <>
                            <label className="flex items-center gap-2">
                              Correct answer
                              <input
                                value={optionLabel(q.correctOptionIndex)}
                                onChange={(e) =>
                                  updateDraft((next) => {
                                    next.objectiveSection.questions[qIndex].correctOptionIndex = optionIndexFromLabel(e.target.value);
                                  })
                                }
                                className="min-h-12 w-16 rounded-lg border border-violet-200 px-2 py-1 text-sm"
                              />
                            </label>
                            <label className="flex items-center gap-2">
                              Marks
                              <input
                                type="number"
                                min={1}
                                value={q.marks}
                                onChange={(e) =>
                                  updateDraft((next) => {
                                    next.objectiveSection.questions[qIndex].marks = Math.max(1, Number(e.target.value) || 1);
                                  })
                                }
                                className="min-h-12 w-20 rounded-lg border border-violet-200 px-2 py-1 text-sm"
                              />
                            </label>
                          </>
                        ) : null}
                      </div>
                    </li>
                  ))}
                </ul>
              </section>

              <hr className="my-5 border-slate-200" />

              <section>
                <h3 className="text-lg font-bold text-slate-900">
                  {previewResult.sections.theory.title} ({previewResult.sections.theory.marks} marks)
                </h3>
                <div className="mt-2 text-sm text-slate-500">{previewResult.theorySection.instructions.join(" ")}</div>
                <ul className="mt-3 space-y-5">
                  {previewResult.theorySection.questions.map((q, qIndex) => (
                    <li key={`theory-${q.mainQuestionNumber}`} className="text-sm text-slate-800">
                      <div className="font-semibold">{q.mainQuestionNumber}.</div>
                      {showEditor ? (
                        <textarea
                          value={q.mainQuestionText}
                          onChange={(e) =>
                            updateDraft((next) => {
                              next.theorySection.questions[qIndex].mainQuestionText = e.target.value;
                            })
                          }
                          className="mt-1 min-h-16 w-full rounded-lg border border-violet-200 px-3 py-2"
                        />
                      ) : (
                        <div className="font-semibold">{q.mainQuestionText} ({q.totalMarks} marks)</div>
                      )}
                      <ul className="mt-2 space-y-2 pl-4">
                        {q.subQuestions.map((sub, subIndex) => (
                          <li key={`theory-${q.mainQuestionNumber}-${sub.label}`}>
                            <div>({sub.label})</div>
                            {showEditor ? (
                              <textarea
                                value={sub.questionText}
                                onChange={(e) =>
                                  updateDraft((next) => {
                                    next.theorySection.questions[qIndex].subQuestions[subIndex].questionText = e.target.value;
                                  })
                                }
                                className="mt-1 min-h-16 w-full rounded-lg border border-violet-200 px-3 py-2"
                              />
                            ) : (
                              <div>{sub.questionText}</div>
                            )}
                            <div className="mt-1 text-xs text-slate-500">Marks: {sub.marks}</div>
                          </li>
                        ))}
                      </ul>
                    </li>
                  ))}
                </ul>
              </section>

              {(() => {
                const essaySection = (previewResult as unknown as {
                  essaySection?: {
                    title?: string;
                    marks?: number;
                    instructions?: string[];
                    questions?: Array<{ questionText?: string; question?: string; marks?: number }>;
                  };
                }).essaySection;
                const essayQuestions = Array.isArray(essaySection?.questions) ? essaySection.questions : [];
                if (!essayQuestions.length) return null;
                return (
                  <>
                    <hr className="my-5 border-slate-200" />
                    <section>
                      <h3 className="text-lg font-bold text-slate-900">
                        {showEditor ? (
                          <input
                            value={essaySection?.title ?? "Essay Section"}
                            onChange={(e) =>
                              updateDraft((next) => {
                                const essay = (next as unknown as { essaySection?: { title?: string } }).essaySection;
                                if (essay) essay.title = e.target.value;
                              }, true)
                            }
                            className="w-full rounded-lg border border-violet-200 px-3 py-2"
                          />
                        ) : (
                          `${essaySection?.title ?? "Essay Section"}${essaySection?.marks ? ` (${essaySection.marks} marks)` : ""}`
                        )}
                      </h3>
                      {essaySection?.instructions?.length ? (
                        <div className="mt-2 text-sm text-slate-500">{essaySection.instructions.join(" ")}</div>
                      ) : null}
                      <ul className="mt-3 space-y-4">
                        {essayQuestions.map((question, idx) => (
                          <li key={`essay-${idx}`} className="text-sm text-slate-800">
                            <div className="font-semibold">{idx + 1}.</div>
                            {showEditor ? (
                              <textarea
                                value={question.questionText ?? question.question ?? ""}
                                onChange={(e) =>
                                  updateDraft((next) => {
                                    const essay = (next as unknown as {
                                      essaySection?: { questions?: Array<{ questionText?: string; question?: string }> };
                                    }).essaySection;
                                    const target = essay?.questions?.[idx];
                                    if (!target) return;
                                    if ("questionText" in target) target.questionText = e.target.value;
                                    else target.question = e.target.value;
                                  }, true)
                                }
                                className="mt-1 min-h-20 w-full rounded-lg border border-violet-200 px-3 py-2"
                              />
                            ) : (
                              <div>{question.questionText ?? question.question}</div>
                            )}
                            {question.marks ? <div className="mt-1 text-xs text-slate-500">Marks: {question.marks}</div> : null}
                          </li>
                        ))}
                      </ul>
                    </section>
                  </>
                );
              })()}

              {teacherMode ? (
                <>
                  <hr className="my-5 border-slate-200" />
                  <section>
                    <h3 className="text-lg font-bold text-slate-900">Marking Guide (Teacher Copy)</h3>
                    <div className="mt-3 rounded-xl border border-emerald-200 bg-emerald-50 p-4">
                      <h4 className="text-sm font-semibold text-emerald-900">Objective Answer Key</h4>
                      <div className="mt-2 grid grid-cols-1 gap-2 text-sm text-emerald-900 sm:grid-cols-4">
                        {previewResult.objectiveSection.questions.map((q, qIndex) => (
                          <label key={`mark-obj-${q.number}`} className="rounded border border-emerald-200 bg-white px-2 py-1">
                            Q{q.number}:{" "}
                            {showEditor ? (
                              <input
                                value={optionLabel(q.correctOptionIndex)}
                                onChange={(e) =>
                                  updateDraft((next) => {
                                    next.objectiveSection.questions[qIndex].correctOptionIndex = optionIndexFromLabel(e.target.value);
                                  })
                                }
                                className="min-h-12 w-16 rounded border border-violet-200 px-2 py-1"
                              />
                            ) : (
                              optionLabel(q.correctOptionIndex)
                            )}
                          </label>
                        ))}
                      </div>
                    </div>

                    <div className="mt-4 space-y-3">
                      {previewResult.theorySection.questions.map((question, qIndex) => (
                        <div key={`mark-theory-${question.mainQuestionNumber}`} className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm">
                          <div className="font-semibold text-slate-900">
                            Theory Question {question.mainQuestionNumber} ({question.totalMarks} marks)
                          </div>
                          <ul className="mt-2 space-y-3">
                            {question.subQuestions.map((sub, subIndex) => (
                              <li key={`mark-sub-${question.mainQuestionNumber}-${sub.label}`}>
                                <div className="font-medium text-slate-800">({sub.label}) - {sub.marks} marks</div>
                                {showEditor ? (
                                  <>
                                    <textarea
                                      value={sub.suggestedAnswer}
                                      onChange={(e) =>
                                        updateDraft((next) => {
                                          next.theorySection.questions[qIndex].subQuestions[subIndex].suggestedAnswer = e.target.value;
                                        })
                                      }
                                      placeholder="Suggested answer"
                                      className="mt-2 min-h-16 w-full rounded-lg border border-violet-200 px-3 py-2"
                                    />
                                    <textarea
                                      value={sub.markingPoints.join("\n")}
                                      onChange={(e) =>
                                        updateDraft((next) => {
                                          next.theorySection.questions[qIndex].subQuestions[subIndex].markingPoints = e.target.value
                                            .split(/\r?\n/)
                                            .map((x) => x.trim())
                                            .filter(Boolean);
                                        })
                                      }
                                      placeholder="One marking point per line"
                                      className="mt-2 min-h-20 w-full rounded-lg border border-violet-200 px-3 py-2"
                                    />
                                  </>
                                ) : (
                                  <>
                                    {sub.suggestedAnswer ? <div className="text-slate-700">Suggested answer: {sub.suggestedAnswer}</div> : null}
                                    {sub.markingPoints.length ? (
                                      <ul className="list-disc pl-5 text-slate-700">
                                        {sub.markingPoints.map((point, idx) => (
                                          <li key={`point-${idx}`}>{point}</li>
                                        ))}
                                      </ul>
                                    ) : null}
                                  </>
                                )}
                              </li>
                            ))}
                          </ul>
                        </div>
                      ))}
                    </div>
                  </section>
                </>
              ) : null}
            </article>
          )}
        </section>
      </div>
    </div>
  );
}
