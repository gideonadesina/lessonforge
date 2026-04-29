"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  formatNaira,
  SCHOOL_PRICING_PLANS,
  TEACHER_PRICING_PLANS,
} from "@/lib/billing/pricing";

type TeacherVerifyResult = {
  type?: "teacher_plan";
  plan: string;
  creditsAwarded: number;
  newBalance: number;
  previousBalance: number;
  alreadyProcessed: boolean;
};

type SchoolVerifyResult = {
  type: "school_plan";
  plan: string;
  amountPaid: number;
  currency: string;
  sharedCreditsAwarded: number;
  newBalance: number;
  previousBalance: number;
  schoolCode: string | null;
  alreadyProcessed: boolean;
  redirectTo?: string;
};

type VerifyResult = TeacherVerifyResult | SchoolVerifyResult;

function SuccessContent() {
  const searchParams = useSearchParams();
  const reference = searchParams.get("reference") ?? "";

  const [loading, setLoading] = useState(true);
  const [result, setResult] = useState<VerifyResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!reference) {
      setError(
        "No payment reference found. Check your email for confirmation or contact support if credits are missing."
      );
      setLoading(false);
      return;
    }

    let cancelled = false;

    async function verify() {
      try {
        const res = await fetch(
          `/api/paystack/verify?reference=${encodeURIComponent(reference)}`
        );
        const data = await res.json();
        if (cancelled) return;
        if (!res.ok || !data.ok) {
          setError(
            data.error ??
              "Payment verification failed. Please contact support if credits are missing."
          );
        } else {
          setResult(data as VerifyResult);
        }
      } catch {
        if (!cancelled) {
          setError("Could not reach the server. Please try again.");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void verify();
    return () => {
      cancelled = true;
    };
  }, [reference]);

  if (loading) {
    return (
      <div className="flex min-h-[300px] items-center justify-center">
        <p className="text-sm text-[var(--text-secondary)]">
          Confirming your payment...
        </p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="mx-auto max-w-md rounded-2xl border border-rose-200 bg-rose-50 p-8 text-center">
        <h1 className="text-xl font-bold text-rose-900">Verification failed</h1>
        <p className="mt-2 text-sm text-rose-700">{error}</p>
        <Link
          href="/dashboard"
          className="mt-6 inline-block rounded-xl bg-violet-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-violet-700"
        >
          Go to Dashboard
        </Link>
      </div>
    );
  }

  const isSchoolPlan = result?.type === "school_plan";
  const teacherPlan = TEACHER_PRICING_PLANS.find((p) => p.id === result?.plan);
  const schoolPlan = SCHOOL_PRICING_PLANS.find((p) => p.id === result?.plan);
  const planName = isSchoolPlan
    ? schoolPlan?.name ?? result?.plan ?? "-"
    : teacherPlan?.name ?? result?.plan ?? "-";
  const amountPaid =
    isSchoolPlan && typeof result.amountPaid === "number"
      ? result.currency === "NGN"
        ? formatNaira(result.amountPaid)
        : `${result.currency} ${result.amountPaid.toLocaleString()}`
      : null;
  const creditsAdded = isSchoolPlan
    ? result?.sharedCreditsAwarded ?? 0
    : result?.creditsAwarded ?? 0;

  return (
    <div className="mx-auto max-w-md rounded-2xl border border-[var(--border)] bg-[var(--card)] p-8 shadow-sm">
      <div className="mb-5 flex justify-center">
        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-emerald-100">
          <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
            <circle cx="14" cy="14" r="13" stroke="#059669" strokeWidth="1.5" />
            <path
              d="M8 14l4 4 8-8"
              stroke="#059669"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </div>
      </div>

      <h1 className="text-center text-2xl font-bold text-[var(--text-primary)]">
        {isSchoolPlan ? "School workspace created!" : "Payment confirmed"}
      </h1>
      <p className="mt-1 text-center text-sm text-[var(--text-secondary)]">
        {isSchoolPlan
          ? "Your school workspace is ready and the shared credit pool has been funded."
          : "Your credits have been added to your account."}
      </p>

      <div className="mt-6 divide-y divide-[var(--border)] rounded-xl border border-[var(--border)]">
        <div className="flex items-center justify-between gap-4 px-4 py-3">
          <span className="text-sm text-[var(--text-secondary)]">Plan</span>
          <span className="text-sm font-semibold text-[var(--text-primary)]">
            {planName}
          </span>
        </div>
        {isSchoolPlan && amountPaid ? (
          <div className="flex items-center justify-between gap-4 px-4 py-3">
            <span className="text-sm text-[var(--text-secondary)]">Amount paid</span>
            <span className="text-sm font-semibold text-[var(--text-primary)]">
              {amountPaid}
            </span>
          </div>
        ) : null}
        <div className="flex items-center justify-between gap-4 px-4 py-3">
          <span className="text-sm text-[var(--text-secondary)]">
            {isSchoolPlan ? "Credits added to school pool" : "Credits added"}
          </span>
          <span className="text-sm font-semibold text-emerald-600">
            +{creditsAdded}
          </span>
        </div>
        <div className="flex items-center justify-between gap-4 px-4 py-3">
          <span className="text-sm text-[var(--text-secondary)]">
            {isSchoolPlan ? "School pool balance" : "New balance"}
          </span>
          <span className="text-sm font-bold text-[var(--text-primary)]">
            {result?.newBalance ?? 0} credits
          </span>
        </div>
      </div>

      {isSchoolPlan ? (
        <div className="mt-6 rounded-xl border border-violet-200 bg-violet-50 p-4">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-violet-700">
            School code
          </p>
          <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <code className="rounded-lg border border-violet-200 bg-white px-4 py-3 text-center text-xl font-bold tracking-[0.2em] text-[var(--text-primary)]">
              {result.schoolCode ?? "Pending"}
            </code>
            {result.schoolCode ? (
              <button
                type="button"
                onClick={async () => {
                  await navigator.clipboard.writeText(result.schoolCode ?? "");
                  setCopied(true);
                  window.setTimeout(() => setCopied(false), 1800);
                }}
                className="rounded-xl bg-violet-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-violet-700"
              >
                {copied ? "Copied" : "Copy"}
              </button>
            ) : null}
          </div>
          <p className="mt-3 text-sm text-violet-800">
            Share this code with your teachers so they can join your school workspace.
          </p>
        </div>
      ) : null}

      <Link
        href={isSchoolPlan ? "/principal/dashboard" : "/dashboard"}
        className="mt-6 block w-full rounded-xl bg-violet-600 py-3 text-center text-sm font-semibold text-white hover:bg-violet-700"
      >
        {isSchoolPlan ? "Go to Principal Dashboard" : "Go to Dashboard"}
      </Link>
    </div>
  );
}

export default function BillingSuccessPage() {
  return (
    <div className="px-4 py-8">
      <Suspense
        fallback={
          <div className="flex min-h-[300px] items-center justify-center">
            <p className="text-sm text-[var(--text-secondary)]">Loading...</p>
          </div>
        }
      >
        <SuccessContent />
      </Suspense>
    </div>
  );
}
