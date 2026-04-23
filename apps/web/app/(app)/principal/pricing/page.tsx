"use client";

import { useCallback, useEffect, useState } from "react";
import { createBrowserSupabase } from "@/lib/supabase/browser";
import LessonForgeWordmark from "@/components/auth/LessonForgeWordmark";
import AuthNotificationBanner from "@/components/auth/AuthNotificationBanner";
import {
  SCHOOL_PRICING_PLANS,
  getCreditUsageNote,
} from "@/lib/billing/pricing";
import SchoolPricingPlanCard from "@/components/billing/SchoolPricingPlanCard";

export default function PrincipalPricingPage() {
  const [busyPlanId, setBusyPlanId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [verifyReference, setVerifyReference] = useState<string | null>(null);
  const [verifyError, setVerifyError] = useState<string | null>(null);
  const [verifyingPayment, setVerifyingPayment] = useState(false);

  async function getAccessToken() {
    const supabase = createBrowserSupabase();
    const {
      data: { session },
    } = await supabase.auth.getSession();
    return session?.access_token ?? "";
  }

  const verifySchoolPayment = useCallback(async (reference: string) => {
    setVerifyingPayment(true);
    setVerifyError(null);
    setVerifyReference(reference);

    try {
      const token = await getAccessToken();
      if (!token) {
        throw new Error("Session expired. Please log in again.");
      }

      const res = await fetch(
        `/api/paystack/school/verify?reference=${encodeURIComponent(reference)}`,
        {
          method: "GET",
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );
      const json = await res.json();

      if (!res.ok || !json?.ok) {
        throw new Error(json?.error || "Failed to verify school payment");
      }

      window.location.href = `/billing/success?type=school&reference=${encodeURIComponent(reference)}`;
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "School payment verification failed";
      setVerifyError(message);
    } finally {
      setVerifyingPayment(false);
    }
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const paymentComplete = params.get("paymentComplete");
    const reference = String(params.get("reference") ?? "").trim();

    if (paymentComplete === "true" && reference && verifyReference !== reference) {
      void verifySchoolPayment(reference);
    }
  }, [verifyReference, verifySchoolPayment]);

  async function handleSchoolPlanSelect(planId: (typeof SCHOOL_PRICING_PLANS)[number]["id"]) {
    if (planId === "school_enterprise") {
      window.location.href = "mailto:support@lessonforge.io?subject=Enterprise%20Pricing%20Inquiry";
      return;
    }

    setBusyPlanId(planId);
    setError(null);

    try {
      const supabase = createBrowserSupabase();
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        throw new Error("Please log in to continue.");
      }

      const token = await getAccessToken();
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
      <section className="rounded-[20px] border border-[#E2E8F0] bg-white px-6 py-8 shadow-[0_4px_24px_rgba(83,74,183,0.08)] sm:px-8">
        <div className="mb-6 flex justify-center">
          <LessonForgeWordmark href={null} />
        </div>
        <div className="max-w-3xl space-y-3">
          <p
            className="inline-flex rounded-full bg-[#EEEDFE] px-3 py-1 text-xs uppercase text-[#534AB7]"
            style={{ fontFamily: '"Trebuchet MS", sans-serif', letterSpacing: "2.5px" }}
          >
            School & Principal Pricing
          </p>
          <h1
            className="text-3xl font-bold tracking-tight text-[#1E1B4B] sm:text-4xl"
            style={{ fontFamily: '"Playfair Display", Georgia, serif' }}
          >
            Power your entire school.
          </h1>
          <p
            className="text-sm leading-relaxed text-[#475569] sm:text-base"
            style={{ fontFamily: '"Trebuchet MS", sans-serif' }}
          >
            Generate as you go — plans, worksheets, slides, and more. Pick what fits your classroom.
          </p>
        </div>
      </section>

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {verifyingPayment && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          Verifying your school payment...
        </div>
      )}

      {verifyError && verifyReference && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          <p>{verifyError}</p>
          <button
            type="button"
            onClick={() => void verifySchoolPayment(verifyReference)}
            className="mt-3 rounded-lg border border-red-300 bg-[var(--card)] px-3 py-1.5 text-xs font-semibold text-red-700 hover:bg-red-50"
          >
            Try again
          </button>
        </div>
      )}

      <AuthNotificationBanner
        type="celebration"
        icon="🎊"
        message="You have fully explored LessonForge with your free credits — now let us unlock the full experience."
        subtext="Give your whole school the tools to plan smarter — together, in one workspace."
      />

      <section className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4 mt-4">
        {SCHOOL_PRICING_PLANS.map((plan) => (
          <SchoolPricingPlanCard
            key={plan.id}
            plan={plan}
            loading={busyPlanId === plan.id}
            onSelect={handleSchoolPlanSelect}
            packLabel="resource packs"
          />
        ))}
      </section>

      <section className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-5 text-sm text-[var(--text-secondary)] shadow-sm">
        <div className="space-y-2">
          <p className="font-semibold text-[var(--text-primary)]">{getCreditUsageNote()}</p>
          <p className="pt-2 font-semibold text-[var(--text-primary)]">Credits are shared across all teachers in your school</p>
          <p className="text-xs text-[var(--text-secondary)]">
            The principal sets overall spending limits, creates department groups, and manages teacher credit allocations.
          </p>
        </div>
      </section>

      <section className="rounded-3xl border border-[var(--border)] bg-[var(--card)] p-6 shadow-sm">
        <h2 className="mb-4 text-xl font-bold text-[var(--text-primary)]">Plan Comparison</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b border-[var(--border)]">
              <tr>
                <th className="px-4 py-3 text-left font-semibold text-[var(--text-primary)]">Feature</th>
                <th className="px-4 py-3 text-left font-semibold text-[var(--text-primary)]">Starter</th>
                <th className="px-4 py-3 text-left font-semibold text-[var(--text-primary)]">Growth</th>
                <th className="px-4 py-3 text-left font-semibold text-[var(--text-primary)]">Full School</th>
                <th className="px-4 py-3 text-left font-semibold text-[var(--text-primary)]">Enterprise</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border)]">
              <tr>
                <td className="px-4 py-3 text-[var(--text-secondary)]">Principal dashboard</td>
                <td className="px-4 py-3 text-center font-semibold text-violet-600">✓</td>
                <td className="px-4 py-3 text-center font-semibold text-violet-600">✓</td>
                <td className="px-4 py-3 text-center font-semibold text-violet-600">✓</td>
                <td className="px-4 py-3 text-center font-semibold text-violet-600">✓</td>
              </tr>
              <tr>
                <td className="px-4 py-3 text-[var(--text-secondary)]">Department grouping</td>
                <td className="px-4 py-3 text-center text-[var(--text-tertiary)]">—</td>
                <td className="px-4 py-3 text-center font-semibold text-violet-600">✓</td>
                <td className="px-4 py-3 text-center font-semibold text-violet-600">✓</td>
                <td className="px-4 py-3 text-center font-semibold text-violet-600">✓</td>
              </tr>
              <tr>
                <td className="px-4 py-3 text-[var(--text-secondary)]">Per-teacher credit limits</td>
                <td className="px-4 py-3 text-center text-[var(--text-tertiary)]">—</td>
                <td className="px-4 py-3 text-center font-semibold text-violet-600">✓</td>
                <td className="px-4 py-3 text-center font-semibold text-violet-600">✓</td>
                <td className="px-4 py-3 text-center font-semibold text-violet-600">✓</td>
              </tr>
              <tr>
                <td className="px-4 py-3 text-[var(--text-secondary)]">Credits validity</td>
                <td className="px-4 py-3 text-center text-xs text-[var(--text-tertiary)]">Until fully used</td>
                <td className="px-4 py-3 text-center text-xs text-[var(--text-tertiary)]">Until fully used</td>
                <td className="px-4 py-3 text-center text-xs text-[var(--text-tertiary)]">Until fully used</td>
                <td className="px-4 py-3 text-center text-xs text-[var(--text-tertiary)]">Until fully used</td>
              </tr>
              <tr>
                <td className="px-4 py-3 text-[var(--text-secondary)]">Priority support</td>
                <td className="px-4 py-3 text-center text-[var(--text-tertiary)]">—</td>
                <td className="px-4 py-3 text-center text-[var(--text-tertiary)]">—</td>
                <td className="px-4 py-3 text-center font-semibold text-violet-600">✓</td>
                <td className="px-4 py-3 text-center font-semibold text-violet-600">✓</td>
              </tr>
              <tr>
                <td className="px-4 py-3 text-[var(--text-secondary)]">White-label option</td>
                <td className="px-4 py-3 text-center text-[var(--text-tertiary)]">—</td>
                <td className="px-4 py-3 text-center text-[var(--text-tertiary)]">—</td>
                <td className="px-4 py-3 text-center text-[var(--text-tertiary)]">—</td>
                <td className="px-4 py-3 text-center font-semibold text-violet-600">✓</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      <section className="rounded-3xl border border-[var(--border)] bg-[var(--card)] p-6 shadow-sm">
        <h2 className="text-xl font-bold text-[var(--text-primary)]">Billing & Next Steps</h2>
        <div className="mt-4 space-y-4">
          <article className="rounded-2xl border border-[var(--border)] bg-[var(--card-alt)] p-4">
            <h3 className="text-sm font-semibold text-[var(--text-primary)]">How does charging work?</h3>
            <p className="mt-2 text-sm leading-relaxed text-[var(--text-secondary)]">
              Choose your plan above. You will be guided to a secure Paystack checkout to enter payment details and complete the transaction. Your school workspace activation is instant upon successful payment.
            </p>
          </article>
          <article className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
            <h3 className="text-sm font-semibold text-slate-900">What happens after I pay?</h3>
            <p className="mt-2 text-sm leading-relaxed text-slate-600">
              Your school&apos;s credit pool is activated and visible in your Principal Billing dashboard. You can immediately add teacher accounts and begin distributing credits.
            </p>
          </article>
          <article className="rounded-2xl border border-[var(--border)] bg-[var(--card-alt)] p-4">
            <h3 className="text-sm font-semibold text-[var(--text-primary)]">Can I upgrade or change plans?</h3>
            <p className="mt-2 text-sm leading-relaxed text-[var(--text-secondary)]">
              Yes. When credits run out, return here to choose a new plan and complete another manual purchase.
            </p>
          </article>
        </div>
      </section>
    </div>
  );
}
