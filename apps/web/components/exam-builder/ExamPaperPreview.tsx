"use client";

import type { ExamRecord, ExamResult } from "@/lib/exams/types";

export const EXAM_PRINT_ID = "lessonforge-exam-print";

function optionLabel(index: number) {
  return (["A", "B", "C", "D"][index] ?? "A") as "A" | "B" | "C" | "D";
}

function asResult(exam: ExamRecord | null): ExamResult | null {
  if (!exam) return null;
  if (!exam.result_json || typeof exam.result_json !== "object") return null;
  return exam.result_json as unknown as ExamResult;
}

export default function ExamPaperPreview({
  exam,
  teacherMode,
}: {
  exam: ExamRecord | null;
  teacherMode: boolean;
}) {
  const result = asResult(exam);

  if (!result) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-slate-50 p-6 text-sm text-slate-600">
        No exam selected yet. Generate or open a saved exam to preview the paper.
      </div>
    );
  }

  return (
    <>
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

      <article id={EXAM_PRINT_ID} className="rounded-2xl border border-slate-200 bg-white p-6">
        <header className="text-center">
          {result.printableHeader.schoolName ? (
            <div className="text-sm font-semibold uppercase tracking-wide text-slate-700">
              {result.printableHeader.schoolName}
            </div>
          ) : null}
          <h2 className="mt-1 text-xl font-bold text-slate-900">{result.printableHeader.examTitle}</h2>
          <div className="mt-2 text-sm text-slate-700">
            {result.printableHeader.subject} | {result.printableHeader.classOrGrade} |{" "}
            {result.printableHeader.schoolLevel}
          </div>
          <div className="mt-1 text-xs text-slate-500">
            {result.printableHeader.curriculum} | {result.printableHeader.examAlignment} |{" "}
            {result.printableHeader.examType}
          </div>
          <div className="mt-1 text-xs text-slate-500">
            Duration: {result.printableHeader.durationLabel} | Total Marks:{" "}
            {result.printableHeader.totalMarks}
          </div>
          <div className="mt-3 grid grid-cols-2 gap-2 text-left text-xs text-slate-700 sm:grid-cols-4">
            {result.printableHeader.candidateFields.map((field) => (
              <div key={field} className="rounded-lg border border-slate-200 px-2 py-1">
                {field}: __________________
              </div>
            ))}
          </div>
        </header>

        <hr className="my-5 border-slate-200" />

        <section>
          <h3 className="text-sm font-semibold text-slate-900">General Instructions</h3>
          <ul className="mt-2 list-disc space-y-1 pl-6 text-sm text-slate-700">
            {result.instructions.map((line, idx) => (
              <li key={`${line}-${idx}`}>{line}</li>
            ))}
          </ul>
        </section>

        <hr className="my-5 border-slate-200" />

        <section>
          <h3 className="text-base font-bold text-slate-900">
            {result.sections.objective.title} ({result.sections.objective.marks} marks)
          </h3>
          <ul className="mt-3 space-y-4">
            {result.objectiveSection.questions.map((q) => (
              <li key={`obj-${q.number}`} className="text-sm text-slate-800">
                <div className="font-semibold">
                  {q.number}. {q.questionText}
                </div>
                <div className="mt-2 grid gap-2 sm:grid-cols-2">
                  {q.options.map((option, idx) => (
                    <div key={`obj-${q.number}-${idx}`} className="rounded-xl border border-slate-200 px-3 py-2">
                      <span className="font-semibold">{optionLabel(idx)}.</span> {option}
                    </div>
                  ))}
                </div>
                <div className="mt-2 text-xs text-slate-500">Marks: {q.marks}</div>
              </li>
            ))}
          </ul>
        </section>

        <hr className="my-5 border-slate-200" />

        <section>
          <h3 className="text-base font-bold text-slate-900">
            {result.sections.theory.title} ({result.sections.theory.marks} marks)
          </h3>
          <div className="mt-2 text-xs text-slate-500">{result.theorySection.instructions.join(" ")}</div>
          <ul className="mt-3 space-y-5">
            {result.theorySection.questions.map((q) => (
              <li key={`theory-${q.mainQuestionNumber}`} className="text-sm text-slate-800">
                <div className="font-semibold">
                  {q.mainQuestionNumber}. {q.mainQuestionText} ({q.totalMarks} marks)
                </div>
                <ul className="mt-2 space-y-2 pl-4">
                  {q.subQuestions.map((sub) => (
                    <li key={`theory-${q.mainQuestionNumber}-${sub.label}`}>
                      <div>
                        ({sub.label}) {sub.questionText}
                      </div>
                      <div className="mt-1 text-xs text-slate-500">Marks: {sub.marks}</div>
                    </li>
                  ))}
                </ul>
              </li>
            ))}
          </ul>
        </section>

        {teacherMode ? (
          <>
            <hr className="my-5 border-slate-200" />

            <section>
              <h3 className="text-base font-bold text-slate-900">Marking Guide (Teacher Copy)</h3>
              <div className="mt-3 rounded-xl border border-emerald-200 bg-emerald-50 p-4">
                <h4 className="text-sm font-semibold text-emerald-900">Objective Answer Key</h4>
                <div className="mt-2 grid grid-cols-2 gap-2 text-sm text-emerald-900 sm:grid-cols-4">
                  {result.markingGuide.objectiveAnswerKey.map((item) => (
                    <div key={`mark-obj-${item.questionNumber}`} className="rounded border border-emerald-200 bg-white px-2 py-1">
                      Q{item.questionNumber}: {item.answerLabel} ({item.marks}m)
                    </div>
                  ))}
                </div>
              </div>

              <div className="mt-4 space-y-3">
                {result.markingGuide.theoryGuide.map((questionGuide) => (
                  <div
                    key={`mark-theory-${questionGuide.mainQuestionNumber}`}
                    className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm"
                  >
                    <div className="font-semibold text-slate-900">
                      Theory Question {questionGuide.mainQuestionNumber} ({questionGuide.totalMarks} marks)
                    </div>
                    <ul className="mt-2 space-y-2">
                      {questionGuide.subQuestions.map((sub) => (
                        <li key={`mark-sub-${questionGuide.mainQuestionNumber}-${sub.label}`}>
                          <div className="font-medium text-slate-800">
                            ({sub.label}) - {sub.marks} marks
                          </div>
                          {sub.suggestedAnswer ? (
                            <div className="text-slate-700">Suggested answer: {sub.suggestedAnswer}</div>
                          ) : null}
                          {sub.markingPoints.length ? (
                            <ul className="list-disc pl-5 text-slate-700">
                              {sub.markingPoints.map((point, idx) => (
                                <li key={`point-${idx}`}>{point}</li>
                              ))}
                            </ul>
                          ) : null}
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
    </>
  );
}
