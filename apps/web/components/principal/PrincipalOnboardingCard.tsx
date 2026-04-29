"use client";

import { useState } from "react";
import Link from "next/link";
import SectionCard from "@/components/principal/SectionCard";
import {
  SCHOOL_PRICING_PLANS,
  type SchoolPlanId,
  formatNaira,
} from "@/lib/billing/pricing";

type Props = {
  getToken: () => Promise<string>;
  onCompleted: () => Promise<void>;
  setParentError: (message: string | null) => void;
};

export default function PrincipalOnboardingCard({ setParentError }: Props) {
  const [step, setStep] = useState<1 | 2>(1);
  const [principalName, setPrincipalName] = useState("");
  const [schoolName, setSchoolName] = useState("");
  const [busy, setBusy] = useState(false);
  const visiblePlanIds: SchoolPlanId[] = ["school_starter", "school_growth"];
  const visiblePlans = SCHOOL_PRICING_PLANS.filter((plan) =>
    visiblePlanIds.includes(plan.id)
  );

  function skipForNow() {
    setBusy(true);
    setParentError(null);
    window.localStorage.setItem("lessonforge:principal-onboarding-skipped", "1");
    window.location.href = "/principal/dashboard";
  }

  return (
    <SectionCard
      title="School setup"
      subtitle="Set up your principal workspace in two quick steps."
      action={<div className="text-xs text-[var(--text-secondary)]">Step {step} of 2</div>}
    >
      <div className="grid grid-cols-2 gap-2 pb-2">
        {[1, 2].map((n) => (
          <div
            key={n}
            className={`h-1.5 rounded-full ${step >= n ? "bg-violet-600" : "bg-slate-200"}`}
          />
        ))}
      </div>

      {step === 1 ? (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <label className="space-y-1">
            <span className="text-xs font-semibold uppercase tracking-wide text-[var(--text-secondary)]">
              Principal name
            </span>
            <input
              value={principalName}
              onChange={(e) => setPrincipalName(e.target.value)}
              placeholder="e.g. Amaka Nwosu"
              className="w-full rounded-xl border border-[var(--border)] bg-[var(--card)] px-3 py-2 text-sm text-[var(--text-primary)] outline-none focus:border-violet-500"
            />
          </label>
          <label className="space-y-1">
            <span className="text-xs font-semibold uppercase tracking-wide text-[var(--text-secondary)]">
              School name
            </span>
            <input
              value={schoolName}
              onChange={(e) => setSchoolName(e.target.value)}
              placeholder="e.g. Meadowfield College"
              className="w-full rounded-xl border border-[var(--border)] bg-[var(--card)] px-3 py-2 text-sm text-[var(--text-primary)] outline-none focus:border-violet-500"
            />
          </label>
        </div>
      ) : null}

      {step === 2 ? (
        <div className="space-y-5">
          <div>
            <h2 className="text-2xl font-black tracking-tight text-[var(--text-primary)]">
              Activate Your School Workspace
            </h2>
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-[var(--text-secondary)]">
              One payment unlocks LessonForge for your entire school — unlimited
              teachers, shared credits, and a school code to get your team started.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {visiblePlans.map((plan) => (
              <article
                key={plan.id}
                className={[
                  "relative flex h-full min-h-[260px] flex-col rounded-2xl border bg-white p-5 shadow-[0_6px_24px_rgba(88,28,135,0.08)]",
                  plan.id === "school_growth"
                    ? "border-[#6C63FF] ring-1 ring-[#6C63FF]/20"
                    : "border-[var(--border)]",
                ].join(" ")}
              >
                {plan.id === "school_growth" ? (
                  <span className="absolute right-4 top-4 rounded-full bg-[#6C63FF] px-3 py-1 text-xs font-bold text-white">
                    Most Popular
                  </span>
                ) : null}
                <div className="pr-28">
                  <h3 className="text-lg font-black text-[var(--text-primary)]">
                    {plan.name}
                  </h3>
                  <div className="mt-2 text-3xl font-black tracking-tight text-[var(--text-primary)]">
                    {formatNaira(plan.priceNaira)}
                  </div>
                </div>
                <div className="mt-5 space-y-2 text-sm text-[var(--text-secondary)]">
                  <p>{plan.credits} credits</p>
                  <p>Unlimited teachers</p>
                </div>
                <Link
                  href={`/principal/pricing?schoolPlan=${plan.id}`}
                  className="mt-auto inline-flex w-full items-center justify-center rounded-xl bg-[#6C63FF] px-4 py-3 text-sm font-bold text-white shadow-sm transition hover:bg-[#534AB7]"
                >
                  Pay {formatNaira(plan.priceNaira)}
                </Link>
              </article>
            ))}
          </div>

          <button
            type="button"
            onClick={skipForNow}
            disabled={busy}
            className="text-sm font-semibold text-slate-500 transition hover:text-slate-700 disabled:opacity-60"
          >
            Skip for now — I&apos;ll upgrade later →
          </button>
        </div>
      ) : null}

      <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
        <button
          onClick={() => setStep((s) => (s > 1 ? ((s - 1) as 1 | 2) : s))}
          disabled={busy || step === 1}
          className="rounded-xl border border-[var(--border)] bg-[var(--card)] px-4 py-2 text-sm font-semibold text-[var(--text-secondary)] hover:bg-[var(--card-alt)] disabled:opacity-50"
        >
          Back
        </button>

        {step < 2 ? (
          <button
            onClick={() => {
              if (!principalName.trim() || !schoolName.trim()) {
                setParentError("Please enter principal and school name.");
                return;
              }

              setParentError(null);
              setStep(2);
            }}
            disabled={busy}
            className="rounded-xl bg-violet-600 px-4 py-2 text-sm font-semibold text-white hover:bg-violet-700 disabled:opacity-60"
          >
            Continue
          </button>
        ) : null}
      </div>
    </SectionCard>
  );
}
