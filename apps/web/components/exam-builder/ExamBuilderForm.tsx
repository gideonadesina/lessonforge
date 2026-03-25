"use client";

import type { ReactNode } from "react";

import {
  CURRICULUM_OPTIONS,
  DIFFICULTY_OPTIONS,
  EXAM_ALIGNMENT_OPTIONS,
  EXAM_TYPE_OPTIONS,
  SCHOOL_LEVEL_OPTIONS,
} from "@/lib/exams/constants";
import type { ExamBuilderInput } from "@/lib/exams/types";

type FormState = ExamBuilderInput;

function toInt(value: string, fallback: number) {
  const n = parseInt(value, 10);
  return Number.isFinite(n) ? n : fallback;
}

function Field({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <label className="block">
      <div className="mb-1 text-xs font-semibold text-slate-600">{label}</div>
      {children}
    </label>
  );
}

export default function ExamBuilderForm({
  value,
  loading,
  onChange,
  onSubmit,
}: {
  value: FormState;
  loading: boolean;
  onChange: (next: FormState) => void;
  onSubmit: () => void;
}) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <h2 className="text-lg font-bold text-slate-900">Exam Builder</h2>
      <p className="mt-1 text-sm text-slate-600">
        Build formal, exam-standard papers for assessment (separate from worksheets).
      </p>

      <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
        <Field label="Subject">
          <input
            value={value.subject}
            onChange={(e) => onChange({ ...value, subject: e.target.value })}
            className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
          />
        </Field>

        <Field label="Topic or Coverage Area">
          <input
            value={value.topicOrCoverage}
            onChange={(e) => onChange({ ...value, topicOrCoverage: e.target.value })}
            className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
          />
        </Field>

        <Field label="Class / Grade">
          <input
            value={value.classOrGrade}
            onChange={(e) => onChange({ ...value, classOrGrade: e.target.value })}
            className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
          />
        </Field>

        <Field label="School Level">
          <select
            value={value.schoolLevel}
            onChange={(e) =>
              onChange({
                ...value,
                schoolLevel: e.target.value as FormState["schoolLevel"],
              })
            }
            className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm"
          >
            {SCHOOL_LEVEL_OPTIONS.map((opt) => (
              <option key={opt} value={opt}>
                {opt}
              </option>
            ))}
          </select>
        </Field>

        <Field label="Curriculum / School System">
          <select
            value={value.curriculum}
            onChange={(e) =>
              onChange({
                ...value,
                curriculum: e.target.value as FormState["curriculum"],
              })
            }
            className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm"
          >
            {CURRICULUM_OPTIONS.map((opt) => (
              <option key={opt} value={opt}>
                {opt}
              </option>
            ))}
          </select>
        </Field>

        <Field label="Exam Alignment">
          <select
            value={value.examAlignment}
            onChange={(e) =>
              onChange({
                ...value,
                examAlignment: e.target.value as FormState["examAlignment"],
              })
            }
            className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm"
          >
            {EXAM_ALIGNMENT_OPTIONS.map((opt) => (
              <option key={opt} value={opt}>
                {opt}
              </option>
            ))}
          </select>
        </Field>

        <Field label="Exam Type">
          <select
            value={value.examType}
            onChange={(e) =>
              onChange({
                ...value,
                examType: e.target.value as FormState["examType"],
              })
            }
            className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm"
          >
            {EXAM_TYPE_OPTIONS.map((opt) => (
              <option key={opt} value={opt}>
                {opt}
              </option>
            ))}
          </select>
        </Field>

        <Field label="Difficulty Level">
          <select
            value={value.difficultyLevel}
            onChange={(e) =>
              onChange({
                ...value,
                difficultyLevel: e.target.value as FormState["difficultyLevel"],
              })
            }
            className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm"
          >
            {DIFFICULTY_OPTIONS.map((opt) => (
              <option key={opt} value={opt}>
                {opt}
              </option>
            ))}
          </select>
        </Field>

        <Field label="Duration (minutes)">
          <input
            type="number"
            min={10}
            max={300}
            value={value.durationMins}
            onChange={(e) =>
              onChange({
                ...value,
                durationMins: toInt(e.target.value, value.durationMins),
              })
            }
            className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
          />
        </Field>

        <Field label="Total Marks">
          <input
            type="number"
            min={5}
            max={300}
            value={value.totalMarks}
            onChange={(e) =>
              onChange({
                ...value,
                totalMarks: toInt(e.target.value, value.totalMarks),
              })
            }
            className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
          />
        </Field>

        <Field label="Number of Objective Questions">
          <input
            type="number"
            min={0}
            max={120}
            value={value.objectiveQuestionCount}
            onChange={(e) =>
              onChange({
                ...value,
                objectiveQuestionCount: toInt(e.target.value, value.objectiveQuestionCount),
              })
            }
            className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
          />
        </Field>

        <Field label="Number of Theory Questions">
          <input
            type="number"
            min={0}
            max={40}
            value={value.theoryQuestionCount}
            onChange={(e) =>
              onChange({
                ...value,
                theoryQuestionCount: toInt(e.target.value, value.theoryQuestionCount),
              })
            }
            className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
          />
        </Field>

        <Field label="Optional School Name">
          <input
            value={value.schoolName ?? ""}
            onChange={(e) =>
              onChange({
                ...value,
                schoolName: e.target.value.trim() ? e.target.value : null,
              })
            }
            className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
          />
        </Field>

        <Field label="Optional Exam Title Override">
          <input
            value={value.examTitleOverride ?? ""}
            onChange={(e) =>
              onChange({
                ...value,
                examTitleOverride: e.target.value.trim() ? e.target.value : null,
              })
            }
            className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
          />
        </Field>
      </div>

      <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2">
        <Field label="Instructions (one line per instruction)">
          <textarea
            rows={4}
            value={(value.instructions ?? []).join("\n")}
            onChange={(e) => {
              const lines = e.target.value
                .split(/\r?\n/)
                .map((line) => line.trim())
                .filter(Boolean)
                .slice(0, 10);
              onChange({
                ...value,
                instructions: lines,
              });
            }}
            className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
            placeholder="Answer all questions."
          />
        </Field>

        <Field label="Special Notes (optional)">
          <textarea
            rows={4}
            value={value.specialNotes ?? ""}
            onChange={(e) =>
              onChange({
                ...value,
                specialNotes: e.target.value.trim() ? e.target.value : null,
              })
            }
            className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
            placeholder="Any extra guidance for question style or scope."
          />
        </Field>
      </div>

      <div className="mt-4 flex justify-end">
        <button
          onClick={onSubmit}
          disabled={loading}
          className="rounded-xl bg-violet-600 px-4 py-2 text-sm font-semibold text-white hover:bg-violet-700 disabled:opacity-60"
        >
          {loading ? "Generating exam..." : "Generate Formal Exam"}
        </button>
      </div>
    </section>
  );
}
