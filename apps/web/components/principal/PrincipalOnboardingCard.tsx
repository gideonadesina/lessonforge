"use client";

import { useState } from "react";
import SectionCard from "@/components/principal/SectionCard";
import type { PaymentQuote } from "@/lib/principal/client";
import { getErrorMessage, toNaira } from "@/lib/principal/client";

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
  const [quote, setQuote] = useState<PaymentQuote | null>(null);
  const [busy, setBusy] = useState(false);

  async function getQuote() {
    const token = await getToken();
    if (!token) throw new Error("Session expired.");

    const res = await fetch("/api/principal/payment/quote", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ teacherSlots }),
    });
    const json = await res.json();
    if (!res.ok || !json?.ok) throw new Error(json?.error || "Failed to get payment quote.");
    return json.data as PaymentQuote;
  }

  async function completeOnboarding() {
    setBusy(true);
    setParentError(null);
    try {
      const token = await getToken();
      if (!token) throw new Error("Session expired.");

      const paymentQuote = quote ?? (await getQuote());
      const res = await fetch("/api/principal/onboarding", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          principalName,
          schoolName,
          teacherSlots,
          payment: {
            provider: paymentQuote.provider,
            reference: paymentQuote.reference,
            status: "success",
          },
        }),
      });

      const json = await res.json();
      if (!res.ok || !json?.ok) {
        throw new Error(json?.error || "Failed to create principal workspace.");
      }

      setStep(1);
      setPrincipalName("");
      setSchoolName("");
      setQuote(null);
      await onCompleted();
    } catch (err: unknown) {
      setParentError(getErrorMessage(err, "Onboarding failed."));
    } finally {
      setBusy(false);
    }
  }

  return (
    <SectionCard
      title="School setup"
      subtitle="Set up your principal workspace in three quick steps."
      action={<div className="text-xs text-slate-500">Step {step} of 3</div>}
    >
      <div className="grid grid-cols-3 gap-2 pb-2">
        {[1, 2, 3].map((n) => (
          <div key={n} className={`h-1.5 rounded-full ${step >= n ? "bg-violet-600" : "bg-slate-200"}`} />
        ))}
      </div>

      {step === 1 ? (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <label className="space-y-1">
            <span className="text-xs font-semibold uppercase tracking-wide text-slate-600">Principal name</span>
            <input
              value={principalName}
              onChange={(e) => setPrincipalName(e.target.value)}
              placeholder="e.g. Amaka Nwosu"
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-violet-500"
            />
          </label>
          <label className="space-y-1">
            <span className="text-xs font-semibold uppercase tracking-wide text-slate-600">School name</span>
            <input
              value={schoolName}
              onChange={(e) => setSchoolName(e.target.value)}
              placeholder="e.g. Meadowfield College"
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-violet-500"
            />
          </label>
        </div>
      ) : null}

      {step === 2 ? (
        <div className="space-y-3">
          <div className="rounded-xl border border-slate-200 bg-amber-50/60 p-4">
            <p className="text-sm font-semibold text-slate-900">Choose teacher slots</p>
            <p className="mt-1 text-sm text-slate-600">You are billed per teacher seat, monthly.</p>
            <div className="mt-4 flex items-center gap-3">
              <input
                type="range"
                min={1}
                max={100}
                value={teacherSlots}
                onChange={(e) => setTeacherSlots(Number(e.target.value))}
                className="w-full accent-violet-600"
              />
              <div className="min-w-[64px] rounded-lg border border-violet-200 bg-white px-2 py-1 text-center text-sm font-bold text-violet-700">
                {teacherSlots}
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {step === 3 ? (
        <div className="space-y-3">
          <div className="rounded-xl border border-violet-200 bg-violet-50/50 p-4">
            <p className="text-sm font-bold text-slate-900">Payment summary</p>
            <div className="mt-2 grid grid-cols-1 gap-2 text-sm text-slate-700 md:grid-cols-2">
              <div>
                School: <span className="font-semibold text-slate-900">{schoolName || "—"}</span>
              </div>
              <div>
                Principal: <span className="font-semibold text-slate-900">{principalName || "—"}</span>
              </div>
              <div>
                Teacher slots: <span className="font-semibold text-slate-900">{teacherSlots}</span>
              </div>
              <div>
                Monthly total:{" "}
                <span className="font-semibold text-violet-700">{quote ? toNaira(quote.amount) : "Fetching..."}</span>
              </div>
            </div>
            <p className="mt-3 text-xs text-slate-500">
              Onboarding uses one-time payment confirmation logic. No auto-recurring renewal is enforced.
            </p>
          </div>
        </div>
      ) : null}

      <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
        <button
          onClick={() => setStep((s) => (s > 1 ? ((s - 1) as 1 | 2 | 3) : s))}
          disabled={busy || step === 1}
          className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
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
                try {
                  setParentError(null);
                  const nextQuote = await getQuote();
                  setQuote(nextQuote);
                } catch (err: unknown) {
                  setParentError(getErrorMessage(err, "Failed to get quote."));
                  return;
                }
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
