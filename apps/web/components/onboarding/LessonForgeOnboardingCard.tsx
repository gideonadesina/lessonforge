"use client";

import { useMemo, useState } from "react";
import LessonForgeWordmark from "@/components/auth/LessonForgeWordmark";
import AuthNotificationBanner from "@/components/auth/AuthNotificationBanner";
import { createBrowserSupabase } from "@/lib/supabase/browser";

type Step = 1 | 2 | 3 | 4;

type OnboardingAnswers = {
  role: string;
  subject: string;
  gradeLevels: string[];
  primaryGoal: string;
};

type Props = {
  profileId: string;
  initialAnswers?: Record<string, unknown> | null;
  initialRoleOverride?: string;
  onCompleted: (answers: OnboardingAnswers) => void;
};

const ROLE_OPTIONS = [
  "Classroom Teacher",
  "Head of Department",
  "School Principal",
  "Vice Principal",
  "Curriculum Coordinator",
] as const;

const SUBJECT_OPTIONS = [
  "Mathematics",
  "English / Literature",
  "Sciences",
  "Humanities & Social Studies",
  "Arts & Creative",
  "All Subjects (Admin)",
] as const;

const GRADE_LEVEL_OPTIONS = [
  "Early Years (Pre-K–2)",
  "Primary (3–5)",
  "Middle School (6–8)",
  "High School (9–12)",
  "All Levels",
] as const;

const GOAL_OPTIONS = [
  "Save time on lesson planning",
  "Create worksheets & exams",
  "Build a full term curriculum",
  "Manage school-wide resources",
  "Everything — I want it all",
] as const;

function isLeadershipRole(role: string) {
  const normalized = role.toLowerCase();
  return (
    normalized.includes("principal") ||
    normalized.includes("vice principal") ||
    normalized.includes("curriculum")
  );
}

export default function LessonForgeOnboardingCard({
  profileId,
  initialAnswers,
  initialRoleOverride,
  onCompleted,
}: Props) {
  const supabase = useMemo(() => createBrowserSupabase(), []);
  const seededRole =
    (typeof initialAnswers?.role === "string" ? initialAnswers.role : "") ||
    (initialRoleOverride ?? "");
  const [step, setStep] = useState<Step>(seededRole ? 2 : 1);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [answers, setAnswers] = useState<OnboardingAnswers>({
    role: seededRole,
    subject: typeof initialAnswers?.subject === "string" ? initialAnswers.subject : "",
    gradeLevels: Array.isArray(initialAnswers?.gradeLevels)
      ? initialAnswers.gradeLevels.filter((item): item is string => typeof item === "string")
      : [],
    primaryGoal:
      typeof initialAnswers?.primaryGoal === "string" ? initialAnswers.primaryGoal : "",
  });

  const leadershipCopy = isLeadershipRole(answers.role);

  async function persistAnswers(nextAnswers: OnboardingAnswers, markComplete = false) {
    setSaving(true);
    setError(null);
    try {
      const patch = {
        onboarding_answers: nextAnswers,
        onboarding_completed: markComplete,
        updated_at: new Date().toISOString(),
      };
      const { error: updateErr } = await supabase
        .from("profiles")
        .update(patch)
        .eq("id", profileId);

      if (updateErr) throw updateErr;
      if (!markComplete) {
        setError(null);
      }
      if (markComplete) onCompleted(nextAnswers);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Unable to save onboarding answers.";
      setError(message);
    } finally {
      setSaving(false);
    }
  }

  function getNextStep(current: Step): Step | null {
    if (current >= 4) return null;
    return (current + 1) as Step;
  }

  function getPreviousStep(current: Step): Step | null {
    if (current <= 1) return null;
    return (current - 1) as Step;
  }

  async function handleSingleSelect(
    field: "role" | "subject" | "primaryGoal",
    value: string,
    currentStep: Step
  ) {
    const nextAnswers = {
      ...answers,
      [field]: value,
    };
    setAnswers(nextAnswers);

    const isFinalStep = field === "primaryGoal";
    await persistAnswers(nextAnswers, isFinalStep);
    if (isFinalStep) return;

    window.setTimeout(() => {
      const nextStep = getNextStep(currentStep);
      if (nextStep) setStep(nextStep);
    }, 300);
  }

  async function handleGradesNext() {
    if (!answers.gradeLevels.length) return;
    await persistAnswers(answers, false);
    const nextStep = getNextStep(3);
    if (nextStep) setStep(nextStep);
  }

  function toggleGradeLevel(value: string) {
    setAnswers((current) => {
      const selected = current.gradeLevels.includes(value)
        ? current.gradeLevels.filter((item) => item !== value)
        : [...current.gradeLevels, value];
      return {
        ...current,
        gradeLevels: selected,
      };
    });
  }

  const stepHeading =
    step === 1
      ? "What's your role at school?"
      : step === 2
      ? leadershipCopy
        ? "What does your school primarily focus on?"
        : "What do you primarily teach or oversee?"
      : step === 3
      ? "Which grade levels do you work with?"
      : leadershipCopy
      ? "What would you most like LessonForge to manage for you?"
      : "What would you most like LessonForge to do for you?";

  const stepSubtext =
    step === 1
      ? "We'll tailor your experience around how you work."
      : step === 2
      ? "Pick the closest match."
      : step === 3
      ? "Select all that apply."
      : "We'll put your best tools front and centre.";

  return (
    <div className="mx-auto w-full max-w-2xl space-y-4">
      <AuthNotificationBanner
        type="celebration"
        icon="🎉"
        message="Account created — let's personalise your LessonForge workspace in just 4 steps."
      />

      <section className="rounded-[20px] border border-[#E2E8F0] bg-white p-6 shadow-[0_4px_24px_rgba(83,74,183,0.08)] sm:p-8">
        <div className="mb-6 flex justify-center">
          <LessonForgeWordmark href={null} />
        </div>

        <div className="mb-6 grid grid-cols-4 gap-2">
          {[1, 2, 3, 4].map((index) => (
            <div
              key={index}
              className={`h-[5px] rounded-full ${step >= index ? "bg-[#534AB7]" : "bg-[#EEEDFE]"}`}
            />
          ))}
        </div>

        <p
          className="text-[11px] uppercase text-[#534AB7]"
          style={{ fontFamily: '"Trebuchet MS", sans-serif', letterSpacing: "2.5px" }}
        >
          STEP {step} OF 4
        </p>
        <h2
          className="mt-2 text-3xl font-bold text-[#1E1B4B]"
          style={{ fontFamily: '"Playfair Display", Georgia, serif' }}
        >
          {stepHeading}
        </h2>
        <p
          className="mt-2 text-sm text-[#475569]"
          style={{ fontFamily: '"Trebuchet MS", sans-serif' }}
        >
          {stepSubtext}
        </p>

        <div className="mt-6 space-y-3">
          {step === 1
            ? ROLE_OPTIONS.map((option) => (
                <OptionButton
                  key={option}
                  selected={answers.role === option}
                  label={option}
                  type="radio"
                  onClick={() => void handleSingleSelect("role", option, 1)}
                />
              ))
            : null}
          {step === 2
            ? SUBJECT_OPTIONS.map((option) => (
                <OptionButton
                  key={option}
                  selected={answers.subject === option}
                  label={option}
                  type="radio"
                  onClick={() => void handleSingleSelect("subject", option, 2)}
                />
              ))
            : null}
          {step === 3
            ? GRADE_LEVEL_OPTIONS.map((option) => (
                <OptionButton
                  key={option}
                  selected={answers.gradeLevels.includes(option)}
                  label={option}
                  type="checkbox"
                  onClick={() => toggleGradeLevel(option)}
                />
              ))
            : null}
          {step === 4
            ? GOAL_OPTIONS.map((option) => (
                <OptionButton
                  key={option}
                  selected={answers.primaryGoal === option}
                  label={option}
                  type="radio"
                  onClick={() => void handleSingleSelect("primaryGoal", option, 4)}
                />
              ))
            : null}
        </div>

        {error ? (
          <p
            className="mt-3 text-sm text-[#92400E]"
            style={{ fontFamily: '"Trebuchet MS", sans-serif' }}
          >
            {error}
          </p>
        ) : null}

        <div className="mt-6 flex items-center justify-between">
          <button
            type="button"
            onClick={() => {
              const previousStep = getPreviousStep(step);
              if (previousStep) setStep(previousStep);
            }}
            disabled={!getPreviousStep(step) || saving}
            className="inline-flex items-center justify-center rounded-[12px] border-[1.5px] border-[#534AB7] px-4 py-2 text-sm font-bold text-[#534AB7] transition-all duration-200 hover:bg-[#EEEDFE] disabled:opacity-50"
            style={{ fontFamily: '"Trebuchet MS", sans-serif' }}
          >
            Back
          </button>

          {step === 3 ? (
            <button
              type="button"
              onClick={() => void handleGradesNext()}
              disabled={!answers.gradeLevels.length || saving}
              className="inline-flex items-center justify-center rounded-[12px] bg-gradient-to-br from-[#534AB7] to-[#3D35A0] px-5 py-[11px] text-sm font-bold text-white shadow-[0_4px_16px_rgba(83,74,183,0.35)] transition-all duration-200 hover:-translate-y-[1px] hover:shadow-[0_6px_18px_rgba(83,74,183,0.4)] disabled:opacity-60"
              style={{ fontFamily: '"Trebuchet MS", sans-serif' }}
            >
              {saving ? "Saving..." : "Next →"}
            </button>
          ) : (
            <span
              className="text-xs text-[#94A3B8]"
              style={{ fontFamily: '"Trebuchet MS", sans-serif' }}
            >
              {saving ? "Saving your progress..." : "Single-select steps advance automatically"}
            </span>
          )}
        </div>
      </section>
    </div>
  );
}

function OptionButton({
  selected,
  label,
  type,
  onClick,
}: {
  selected: boolean;
  label: string;
  type: "radio" | "checkbox";
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex w-full items-center gap-3 rounded-[12px] border-[1.5px] px-[18px] py-[14px] text-left transition-all duration-200 ${
        selected
          ? "border-[#534AB7] bg-[#EEEDFE] text-[#534AB7]"
          : "border-[#E2E8F0] bg-white text-[#1E1B4B] hover:border-[#534AB7] hover:bg-[#FAFAFE]"
      }`}
      style={{ fontFamily: '"Trebuchet MS", sans-serif' }}
    >
      <span
        className={`inline-flex h-5 w-5 items-center justify-center ${
          type === "radio" ? "rounded-full" : "rounded-[6px]"
        } border ${selected ? "border-[#534AB7]" : "border-[#94A3B8]"}`}
      >
        {selected ? (
          <span
            className={`${type === "radio" ? "h-2.5 w-2.5 rounded-full" : "h-2.5 w-2.5 rounded-[3px]"} bg-[#534AB7]`}
          />
        ) : null}
      </span>
      <span>{label}</span>
    </button>
  );
}
