"use client";

import Link from "next/link";
import { useMemo } from "react";
import { useSearchParams } from "next/navigation";
import { TEACHER_PRICING_PLANS, formatNaira } from "@/lib/billing/pricing";

export default function TeacherCheckoutPlaceholderPage() {
  const searchParams = useSearchParams();
  const planId = searchParams.get("plan");

  const selectedPlan = useMemo(
    () => TEACHER_PRICING_PLANS.find((plan) => plan.id === planId) ?? null,
    [planId]
  );

  return (
    <div className="mx-auto max-w-2xl rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="inline-flex rounded-full bg-violet-100 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-violet-700">
        Checkout setup in progress
      </div>

      <h1 className="mt-4 text-2xl font-extrabold tracking-tight text-slate-900">
        Teacher checkout is almost ready
      </h1>
      <p className="mt-2 text-sm leading-relaxed text-slate-600">
        This screen is the integration placeholder for the Paystack checkout initialization
        flow. Backend wiring can now plug in here without redesigning the pricing UI.
      </p>

      {selectedPlan ? (
        <div className="mt-5 rounded-2xl border border-violet-100 bg-violet-50/50 p-4 text-sm">
          <p className="font-semibold text-slate-900">Selected plan: {selectedPlan.name}</p>
          <p className="mt-1 text-slate-700">
            {formatNaira(selectedPlan.priceNaira)} • {selectedPlan.credits} credits
          </p>
        </div>
      ) : null}

      <div className="mt-6 flex flex-wrap gap-3">
        <Link
          href="/pricing"
          className="rounded-2xl bg-violet-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-violet-700"
        >
          Back to pricing
        </Link>
        <Link
          href="/dashboard"
          className="rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
        >
          Return to dashboard
        </Link>
      </div>
    </div>
  );
}
