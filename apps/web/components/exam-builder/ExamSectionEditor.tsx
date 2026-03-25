"use client";

import { useEffect, useMemo, useState } from "react";

import type { ExamResult } from "@/lib/exams/types";

function parseOptionsLine(value: string): [string, string, string, string] {
  const parts = value
    .split(/\r?\n/)
    .map((x) => x.trim())
    .filter(Boolean)
    .slice(0, 4);
  while (parts.length < 4) parts.push("");
  return [parts[0], parts[1], parts[2], parts[3]];
}

function optionIndexFromLabel(value: string): 0 | 1 | 2 | 3 {
  const up = value.trim().toUpperCase();
  if (up === "B") return 1;
  if (up === "C") return 2;
  if (up === "D") return 3;
  return 0;
}

function labelFromOptionIndex(index: number): "A" | "B" | "C" | "D" {
  return (["A", "B", "C", "D"][index] ?? "A") as "A" | "B" | "C" | "D";
}

export default function ExamSectionEditor({
  result,
  onSave,
  saving,
}: {
  result: ExamResult;
  onSave: (next: ExamResult) => Promise<void>;
  saving: boolean;
}) {
  const [draft, setDraft] = useState<ExamResult>(result);
  useEffect(() => {
    setDraft(result);
  }, [result]);

  const objectiveMarks = useMemo(
    () => draft.objectiveSection.questions.reduce((sum, q) => sum + q.marks, 0),
    [draft.objectiveSection.questions]
  );
  const theoryMarks = useMemo(
    () =>
      draft.theorySection.questions.reduce(
        (sum, q) => sum + q.subQuestions.reduce((ss, sub) => ss + sub.marks, 0),
        0
      ),
    [draft.theorySection.questions]
  );

  async function handleSave() {
    const next: ExamResult = {
      ...draft,
      sections: {
        objective: {
          ...draft.sections.objective,
          questionCount: draft.objectiveSection.questions.length,
          marks: objectiveMarks,
        },
        theory: {
          ...draft.sections.theory,
          questionCount: draft.theorySection.questions.length,
          marks: theoryMarks,
        },
      },
      markingGuide: {
        ...draft.markingGuide,
        objectiveAnswerKey: draft.objectiveSection.questions.map((q) => ({
          questionNumber: q.number,
          answerLabel: labelFromOptionIndex(q.correctOptionIndex),
          marks: q.marks,
        })),
        theoryGuide: draft.theorySection.questions.map((q) => ({
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
          overall: objectiveMarks + theoryMarks,
        },
      },
      totalMarks: objectiveMarks + theoryMarks,
    };

    await onSave(next);
  }

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <h3 className="text-sm font-bold text-slate-900">Edit Exam Sections</h3>
      <p className="mt-1 text-xs text-slate-600">
        Manual edits are saved back into the same exam schema (`result_json`) for future reuse.
      </p>

      <div className="mt-4 space-y-5">
        <div>
          <div className="mb-2 text-xs font-semibold text-slate-700">Objective Questions</div>
          <div className="space-y-3">
            {draft.objectiveSection.questions.map((q, qIndex) => (
              <div key={`edit-obj-${q.number}`} className="rounded-xl border border-slate-200 p-3">
                <textarea
                  value={q.questionText}
                  onChange={(e) => {
                    const next = { ...draft };
                    next.objectiveSection.questions[qIndex].questionText = e.target.value;
                    setDraft(next);
                  }}
                  rows={2}
                  className="w-full rounded-lg border border-slate-200 px-2 py-2 text-sm"
                />
                <textarea
                  value={q.options.join("\n")}
                  onChange={(e) => {
                    const next = { ...draft };
                    next.objectiveSection.questions[qIndex].options = parseOptionsLine(e.target.value);
                    setDraft(next);
                  }}
                  rows={4}
                  className="mt-2 w-full rounded-lg border border-slate-200 px-2 py-2 text-sm"
                />
                <div className="mt-2 flex gap-2">
                  <input
                    value={labelFromOptionIndex(q.correctOptionIndex)}
                    onChange={(e) => {
                      const next = { ...draft };
                      next.objectiveSection.questions[qIndex].correctOptionIndex = optionIndexFromLabel(
                        e.target.value
                      );
                      setDraft(next);
                    }}
                    className="w-16 rounded-lg border border-slate-200 px-2 py-1 text-xs"
                  />
                  <input
                    type="number"
                    min={1}
                    value={q.marks}
                    onChange={(e) => {
                      const next = { ...draft };
                      next.objectiveSection.questions[qIndex].marks = Math.max(1, Number(e.target.value) || 1);
                      setDraft(next);
                    }}
                    className="w-20 rounded-lg border border-slate-200 px-2 py-1 text-xs"
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        <div>
          <div className="mb-2 text-xs font-semibold text-slate-700">Theory Questions & Sub-Questions</div>
          <div className="space-y-3">
            {draft.theorySection.questions.map((question, qIndex) => (
              <div key={`edit-theory-${question.mainQuestionNumber}`} className="rounded-xl border border-slate-200 p-3">
                <textarea
                  value={question.mainQuestionText}
                  onChange={(e) => {
                    const next = { ...draft };
                    next.theorySection.questions[qIndex].mainQuestionText = e.target.value;
                    setDraft(next);
                  }}
                  rows={2}
                  className="w-full rounded-lg border border-slate-200 px-2 py-2 text-sm"
                />
                <div className="mt-2 space-y-2">
                  {question.subQuestions.map((sub, subIndex) => (
                    <div key={`edit-sub-${question.mainQuestionNumber}-${sub.label}`} className="rounded-lg border border-slate-200 bg-slate-50 p-2">
                      <div className="mb-2 text-xs font-semibold text-slate-600">({sub.label})</div>
                      <textarea
                        value={sub.questionText}
                        onChange={(e) => {
                          const next = { ...draft };
                          next.theorySection.questions[qIndex].subQuestions[subIndex].questionText = e.target.value;
                          setDraft(next);
                        }}
                        rows={2}
                        className="w-full rounded-lg border border-slate-200 px-2 py-2 text-sm"
                      />
                      <textarea
                        value={sub.suggestedAnswer}
                        onChange={(e) => {
                          const next = { ...draft };
                          next.theorySection.questions[qIndex].subQuestions[subIndex].suggestedAnswer = e.target.value;
                          setDraft(next);
                        }}
                        rows={2}
                        className="mt-2 w-full rounded-lg border border-slate-200 px-2 py-2 text-sm"
                        placeholder="Suggested answer"
                      />
                      <textarea
                        value={sub.markingPoints.join("\n")}
                        onChange={(e) => {
                          const next = { ...draft };
                          next.theorySection.questions[qIndex].subQuestions[subIndex].markingPoints = e.target.value
                            .split(/\r?\n/)
                            .map((x) => x.trim())
                            .filter(Boolean);
                          setDraft(next);
                        }}
                        rows={2}
                        className="mt-2 w-full rounded-lg border border-slate-200 px-2 py-2 text-sm"
                        placeholder="One marking point per line"
                      />
                      <input
                        type="number"
                        min={1}
                        value={sub.marks}
                        onChange={(e) => {
                          const next = { ...draft };
                          next.theorySection.questions[qIndex].subQuestions[subIndex].marks = Math.max(
                            1,
                            Number(e.target.value) || 1
                          );
                          setDraft(next);
                        }}
                        className="mt-2 w-20 rounded-lg border border-slate-200 px-2 py-1 text-xs"
                      />
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-700">
          <span>
            Objective: {objectiveMarks} | Theory: {theoryMarks} | Total: {objectiveMarks + theoryMarks}
          </span>
          <button
            onClick={handleSave}
            disabled={saving}
            className="rounded-lg bg-violet-600 px-3 py-1.5 font-semibold text-white hover:bg-violet-700 disabled:opacity-60"
          >
            {saving ? "Saving..." : "Save Section Edits"}
          </button>
        </div>
      </div>
    </section>
  );
}
