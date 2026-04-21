"use client";

import { useState } from "react";
import { createBrowserSupabase } from "@/lib/supabase/browser";
import {
  SCHOOL_PRICING_PLANS,
  getCreditUsageNote,
} from "@/lib/billing/pricing";
import SchoolPricingPlanCard from "@/components/billing/SchoolPricingPlanCard";

export default function PrincipalPricingPage() {
  const [busyPlanId, setBusyPlanId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleSchoolPlanSelect(planId: (typeof SCHOOL_PRICING_PLANS)[number]["id"]) {
    setBusyPlanId(planId);
    setError(null);

    try {
      const supabase = createBrowserSupabase();
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        throw new Error("Please log in to continue.");
      }

      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      if (!token) {
        throw new Error("Session expired. Please log in again.");
      }

      const res = await fetch("/api/paystack/school/initialize", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ plan: planId }),
      });

      const json = await res.json();

      if (!res.ok || !json?.ok) {
        throw new Error(json?.error || "Failed to start payment");
      }

      if (!json.authorization_url) {
        throw new Error("Payment checkout URL missing");
      }

      window.location.href = json.authorization_url;
    } catch (err) {
      const message = err instanceof Error ? err.message : "An error occurred";
      setError(message);
      setBusyPlanId(null);
    }
  }

  return (
    <div className="space-y-8 pb-8">
      <section className="rounded-3xl border border-amber-100 bg-gradient-to-br from-amber-50 via-amber-50/70 to-amber-50 px-6 py-8 shadow-sm sm:px-8">
        <div className="max-w-3xl space-y-3">
          <p className="inline-flex rounded-full bg-amber-200 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-amber-900">
            School & Principal Pricing
          </p>
          <h1 className="text-3xl font-extrabold tracking-tight text-slate-900 sm:text-4xl">
            Deploy LessonForge school-wide. Manage teachers, share credits, scale safely.
          </h1>
          <p className="text-sm leading-relaxed text-slate-600 sm:text-base">
            Credits are shared across all teachers in your school. Principals manage the credit pool,
            set department limits, track usage, and unlock advanced reporting.
          </p>
        </div>
      </section>

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <section className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        {SCHOOL_PRICING_PLANS.map((plan) => (
          <SchoolPricingPlanCard
            key={plan.id}
            plan={plan}
            loading={busyPlanId === plan.id}
            onSelect={handleSchoolPlanSelect}
          />
        ))}
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 text-sm text-slate-700 shadow-sm">
        <div className="space-y-2">
          <p className="font-semibold text-slate-900">{getCreditUsageNote()}</p>
          <p className="font-semibold text-slate-900 pt-2">Credits are shared across all teachers in your school</p>
          <p className="text-xs text-slate-600">
            The principal sets overall spending limits, creates department groups, and manages teacher credit allocations.
          </p>
        </div>
      </section>

      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-xl font-bold text-slate-900 mb-4">Plan Comparison</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b border-slate-200">
              <tr>
                <th className="text-left py-3 px-4 font-semibold text-slate-900">Feature</th>
                <th className="text-left py-3 px-4 font-semibold text-slate-900">Starter</th>
                <th className="text-left py-3 px-4 font-semibold text-slate-900">Growth</th>
                <th className="text-left py-3 px-4 font-semibold text-slate-900">Full School</th>
                <th className="text-left py-3 px-4 font-semibold text-slate-900">Enterprise</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              <tr>
                <td className="py-3 px-4 text-slate-600">Principal dashboard</td>
                <td className="py-3 px-4 text-center text-violet-600 font-semibold">✓</td>
                <td className="py-3 px-4 text-center text-violet-600 font-semibold">✓</td>
                <td className="py-3 px-4 text-center text-violet-600 font-semibold">✓</td>
                <td className="py-3 px-4 text-center text-violet-600 font-semibold">✓</td>
              </tr>
              <tr>
                <td className="py-3 px-4 text-slate-600">Department grouping</td>
                <td className="py-3 px-4 text-center text-slate-300">—</td>
                <td className="py-3 px-4 text-center text-violet-600 font-semibold">✓</td>
                <td className="py-3 px-4 text-center text-violet-600 font-semibold">✓</td>
                <td className="py-3 px-4 text-center text-violet-600 font-semibold">✓</td>
              </tr>
              <tr>
                <td className="py-3 px-4 text-slate-600">Per-teacher credit limits</td>
                <td className="py-3 px-4 text-center text-slate-300">—</td>
                <td className="py-3 px-4 text-center text-violet-600 font-semibold">✓</td>
                <td className="py-3 px-4 text-center text-violet-600 font-semibold">✓</td>
                <td className="py-3 px-4 text-center text-violet-600 font-semibold">✓</td>
              </tr>
              <tr>
                <td className="py-3 px-4 text-slate-600">Credit rollover</td>
                <td className="py-3 px-4 text-center text-slate-500 text-xs">Monthly</td>
                <td className="py-3 px-4 text-center text-slate-500 text-xs">2-month</td>
                <td className="py-3 px-4 text-center text-slate-500 text-xs">3-month</td>
                <td className="py-3 px-4 text-center text-slate-500 text-xs">Custom</td>
              </tr>
              <tr>
                <td className="py-3 px-4 text-slate-600">Priority support</td>
                <td className="py-3 px-4 text-center text-slate-300">—</td>
                <td className="py-3 px-4 text-center text-slate-300">—</td>
                <td className="py-3 px-4 text-center text-violet-600 font-semibold">✓</td>
                <td className="py-3 px-4 text-center text-violet-600 font-semibold">✓</td>
              </tr>
              <tr>
                <td className="py-3 px-4 text-slate-600">White-label option</td>
                <td className="py-3 px-4 text-center text-slate-300">—</td>
                <td className="py-3 px-4 text-center text-slate-300">—</td>
                <td className="py-3 px-4 text-center text-slate-300">—</td>
                <td className="py-3 px-4 text-center text-violet-600 font-semibold">✓</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-xl font-bold text-slate-900">Billing & Next Steps</h2>
        <div className="mt-4 space-y-4">
          <article className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
            <h3 className="text-sm font-semibold text-slate-900">How does charging work?</h3>
            <p className="mt-2 text-sm leading-relaxed text-slate-600">
              Choose your plan above. You will be guided to a secure Paystack checkout to enter payment details and complete the transaction. Your school workspace activation is instant upon successful payment.
            </p>
          </article>
          <article className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
            <h3 className="text-sm font-semibold text-slate-900">What happens after I pay?</h3>
            <p className="mt-2 text-sm leading-relaxed text-slate-600">
              Your school's credit pool is activated and visible in your Principal Billing dashboard. You can immediately add teacher accounts and begin distributing credits.
            </p>
          </article>
          <article className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
            <h3 className="text-sm font-semibold text-slate-900">Can I upgrade or change plans?</h3>
            <p className="mt-2 text-sm leading-relaxed text-slate-600">
              Yes. Visit your Principal Billing page after activation to manage upgrades, teacher slots, and payment history.
            </p>
          </article>
        </div>
      </section>
    </div>
  );
}
