"use client";

import { ProgressStep } from "./useGenerationProgress";

type Props = {
  steps: ProgressStep[];
  currentStepIndex: number;
  progress: number;
};

function StepIcon({ completed, active, index }: { completed: boolean; active: boolean; index: number }) {
  if (completed) {
    return (
      <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-violet-600 text-white shadow-sm">
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="3"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="h-5 w-5"
        >
          <path d="M20 6L9 17l-5-5" />
        </svg>
      </div>
    );
  }

  if (active) {
    return (
      <div className="flex h-10 w-10 items-center justify-center rounded-2xl border border-violet-300 bg-violet-50 text-violet-700 shadow-sm">
        <svg
          viewBox="0 0 24 24"
          className="h-5 w-5 animate-spin"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M12 2a10 10 0 0 1 0 20" />
          <path d="M12 2a10 10 0 0 0 0 20" opacity="0.25" />
        </svg>
      </div>
    );
  }

  return (
    <div className="flex h-10 w-10 items-center justify-center rounded-2xl border border-slate-200 bg-slate-100 text-sm font-semibold text-slate-700 shadow-sm">
      {index + 1}
    </div>
  );
}

export default function GenerationProgress({ steps, currentStepIndex, progress }: Props) {
  const percent = Math.min(100, Math.max(0, Math.round(progress)));

  return (
    <div className="rounded-3xl border border-violet-100 bg-white p-6 shadow-[0_24px_64px_-32px_rgba(124,58,237,0.35)]">
      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-violet-500">
            Lesson generation
          </p>
          <h2 className="text-xl font-semibold text-slate-900">Generating your lesson pack</h2>
        </div>
        <div className="inline-flex items-center rounded-full bg-violet-50 px-4 py-2 text-sm font-semibold text-violet-700">
          {percent}% complete
        </div>
      </div>

      <div className="mb-6 overflow-hidden rounded-full bg-violet-100">
        <div
          className="h-2 rounded-full bg-gradient-to-r from-violet-600 via-violet-500 to-purple-500 transition-all duration-700 ease-out"
          style={{ width: `${percent}%` }}
        />
      </div>

      <div className="space-y-3">
        {steps.map((step, index) => {
          const completed = index < currentStepIndex;
          const active = index === currentStepIndex;

          return (
            <div
              key={step.title}
              className={`flex gap-4 rounded-3xl border px-4 py-4 transition ${
                active ? "border-violet-200 bg-violet-50" : "border-slate-200 bg-white"
              }`}
            >
              <StepIcon completed={completed} active={active} index={index} />
              <div className="min-w-0">
                <p className={`text-sm font-semibold ${active ? "text-violet-900" : "text-slate-900"}`}>
                  {step.title}
                </p>
                <p className="mt-1 text-sm text-slate-500">{step.description}</p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
