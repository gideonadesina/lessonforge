"use client";

import { useState } from "react";
import SectionCard from "@/components/principal/SectionCard";
import { getErrorMessage } from "../../lib/principal/client";
import {
  SCHOOL_PRICING_PLANS,
  type SchoolPlanId,
  formatNaira,
} from "@/lib/billing/pricing";
import { track } from "@/lib/analytics";

type Props = {
  getToken: () => Promise<string>;
  onCompleted: () => Promise<void>;
  setParentError: (message: string | null) => void;
};

export default function PrincipalOnboardingCard({ getToken, onCompleted, setParentError }: Props) {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [principalName, setPrincipalName] = useState("");
  const [schoolName, setSchoolName] = useState("");
  const [teacherSlots, setTeacherSlots] = useState(12);
  const [busy, setBusy] = useState(false);

  function resolvePlanId(slots: number): SchoolPlanId {
    if (slots <= 15) return "school_starter";
    if (slots <= 35) return "school_growth";
    if (slots <= 70) return "school_full";
    return "school_enterprise";
  }

  async function completeOnboarding() {
    setBusy(true);
    setParentError(null);
    try {
      const token = await getToken();
      if (!token) throw new Error("Session expired.");

      const planId = resolvePlanId(teacherSlots);
      const res = await fetch("/api/paystack/school/initialize", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          plan: planId,
          callbackPath: "/payment/success?type=school",
          schoolName: schoolName.trim() || undefined,
        }),
      });

      const json = await res.json();
      if (!res.ok || !json?.ok) {
        throw new Error(json?.error || "Failed to initialize school payment.");
      }

      if (!json?.authorization_url) {
        throw new Error("Payment checkout URL missing.");
      }

      const selectedPlan = SCHOOL_PRICING_PLANS.find((plan) => plan.id === planId);
      track("payment_started", {
        user_role: "principal",
        active_role: "principal",
        plan_name: selectedPlan?.name ?? planId,
        school_name: schoolName.trim() || undefined,
      });
      window.location.href = json.authorization_url;
    } catch (err: unknown) {
      track("payment_failed", {
        user_role: "principal",
        active_role: "principal",
        plan_name: resolvePlanId(teacherSlots),
        school_name: schoolName.trim() || undefined,
      });
      setParentError(getErrorMessage(err, "Onboarding failed."));
    } finally {
      setBusy(false);
    }
  }

  return (
    <SectionCard
      title="School setup"
      subtitle="Set up your principal workspace in three quick steps."
      action={<div className="text-xs text-[var(--text-secondary)]">Step {step} of 3</div>}
    >
      <div className="grid grid-cols-3 gap-2 pb-2">
        {[1, 2, 3].map((n) => (
          <div key={n} className={`h-1.5 rounded-full ${step >= n ? "bg-violet-600" : "bg-slate-200"}`} />
        ))}
      </div>

      {step === 1 ? (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <label className="space-y-1">
            <span className="text-xs font-semibold uppercase tracking-wide text-[var(--text-secondary)]">Principal name</span>
            <input
              value={principalName}
              onChange={(e) => setPrincipalName(e.target.value)}
              placeholder="e.g. Amaka Nwosu"
              className="w-full rounded-xl border border-[var(--border)] bg-[var(--card)] px-3 py-2 text-sm text-[var(--text-primary)] outline-none focus:border-violet-500"
            />
          </label>
          <label className="space-y-1">
            <span className="text-xs font-semibold uppercase tracking-wide text-[var(--text-secondary)]">School name</span>
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
        <div className="space-y-3">
          <div className="rounded-xl border border-amber-200 bg-amber-50/60 p-4 dark:border-amber-900/50 dark:bg-amber-900/20">
            <p className="text-sm font-semibold text-[var(--text-primary)]">Choose teacher slots</p>
            <p className="mt-1 text-sm text-[var(--text-secondary)]">
              We map your teacher count to the best school plan for a one-time purchase.
            </p>
            <div className="mt-4 flex items-center gap-3">
              <input
                type="range"
                min={1}
                max={100}
                value={teacherSlots}
                onChange={(e) => setTeacherSlots(Number(e.target.value))}
                className="w-full accent-violet-600"
              />
              <div className="min-w-[64px] rounded-lg border border-violet-200 bg-[var(--card)] px-2 py-1 text-center text-sm font-bold text-violet-700 dark:border-violet-900">
                {teacherSlots}
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {step === 3 ? (
        <div className="space-y-3">
          <div className="rounded-xl border border-violet-200 bg-violet-50/50 p-4 dark:border-violet-900 dark:bg-violet-900/20">
            <p className="text-sm font-bold text-[var(--text-primary)]">Payment summary</p>
            {(() => {
              const selectedPlan = SCHOOL_PRICING_PLANS.find(
                (plan) => plan.id === resolvePlanId(teacherSlots)
              );
              return (
            <div className="mt-2 grid grid-cols-1 gap-2 text-sm text-[var(--text-secondary)] md:grid-cols-2">
              <div>
                School: <span className="font-semibold text-[var(--text-primary)]">{schoolName || "—"}</span>
              </div>
              <div>
                Principal: <span className="font-semibold text-[var(--text-primary)]">{principalName || "—"}</span>
              </div>
              <div>
                Teacher slots: <span className="font-semibold text-[var(--text-primary)]">{teacherSlots}</span>
              </div>
              <div>
                Plan:{" "}
                <span className="font-semibold text-violet-700">
                  {selectedPlan?.name ?? "Starter"}
                </span>
              </div>
              <div>
                Total per purchase:{" "}
                <span className="font-semibold text-violet-700">
                  {selectedPlan?.priceNaira
                    ? formatNaira(selectedPlan.priceNaira)
                    : "Contact support"}
                </span>
              </div>
            </div>
              );
            })()}
            <p className="mt-3 text-xs text-[var(--text-tertiary)]">
              Onboarding uses one-time payment. Credits are assigned per purchase and do not expire.
            </p>
          </div>
        </div>
      ) : null}

      <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
        <button
          onClick={() => setStep((s) => (s > 1 ? ((s - 1) as 1 | 2 | 3) : s))}
          disabled={busy || step === 1}
          className="rounded-xl border border-[var(--border)] bg-[var(--card)] px-4 py-2 text-sm font-semibold text-[var(--text-secondary)] hover:bg-[var(--card-alt)] disabled:opacity-50"
        >
          Back
        </button>

        {step < 3 ? (
          <button
            onClick={async () => {
              if (step === 1 && (!principalName.trim() || !schoolName.trim())) {
                setParentError("Please enter principal and school name.");
                return;
              }

              if (step === 2) {
                setParentError(null);
              }

              setStep((s) => (s < 3 ? ((s + 1) as 1 | 2 | 3) : s));
            }}
            disabled={busy}
            className="rounded-xl bg-violet-600 px-4 py-2 text-sm font-semibold text-white hover:bg-violet-700 disabled:opacity-60"
          >
            Continue
          </button>
        ) : (
          <button
            onClick={completeOnboarding}
            disabled={busy}
            className="rounded-xl bg-violet-600 px-4 py-2 text-sm font-semibold text-white hover:bg-violet-700 disabled:opacity-60"
          >
            {busy ? "Processing..." : "Complete payment & create workspace"}
          </button>
        )}
      </div>
    </SectionCard>
  );
}
