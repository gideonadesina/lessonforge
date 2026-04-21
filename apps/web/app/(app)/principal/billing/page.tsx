"use client";

import { useEffect, useRef, useState } from "react";
import PrincipalPageHeader from "@/components/principal/PrincipalPageHeader";
import SectionCard from "@/components/principal/SectionCard";
import {
  PrincipalForbiddenState,
  PrincipalLoadingState,
  PrincipalOnboardingRequiredState,
} from "@/components/principal/PrincipalStates";
import { formatDateOnly, getErrorMessage, toNaira, usePrincipalDashboard } from "@/lib/principal/client";

const PRINCIPAL_ONBOARDING_STORAGE_KEY = "principal_onboarding_pending";

export default function PrincipalBillingPage() {
  const { supabase, loading, forbidden, error, setError, dashboard, onboardingRequired, getToken, loadDashboard } =
    usePrincipalDashboard();
  const [slotUpgradeBusy, setSlotUpgradeBusy] = useState(false);
  const [paystackBusy, setPaystackBusy] = useState(false);
  const [onboardingBusy, setOnboardingBusy] = useState(false);
  const [addSlots, setAddSlots] = useState(1);
  const onboardingHandledRef = useRef(false);

  useEffect(() => {
    void loadDashboard();
  }, [loadDashboard]);

  useEffect(() => {
    if (onboardingHandledRef.current || typeof window === "undefined") return;

    const params = new URLSearchParams(window.location.search);
    const flow = String(params.get("flow") ?? "").trim();
    if (flow !== "principal_onboarding") return;

    const status = String(params.get("status") ?? "").trim().toLowerCase();
    if (status && status !== "success") {
      onboardingHandledRef.current = true;
      setError("Payment was not completed successfully.");
      return;
    }

    const reference = String(params.get("reference") ?? params.get("trxref") ?? "").trim();
    onboardingHandledRef.current = true;

    void (async () => {
      setOnboardingBusy(true);
      setError(null);
      try {
        const token = await getToken();
        if (!token) throw new Error("Session expired.");

        const rawPending = window.sessionStorage.getItem(PRINCIPAL_ONBOARDING_STORAGE_KEY);
        const pending = rawPending ? (JSON.parse(rawPending) as Record<string, unknown>) : null;
        const resolvedReference =
          reference || String(pending?.reference ?? "").trim();
        if (!resolvedReference) {
          throw new Error("Missing payment reference for principal onboarding verification.");
        }

        const res = await fetch("/api/principal/onboarding", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            principalName: String(pending?.principalName ?? ""),
            schoolName: String(pending?.schoolName ?? ""),
            teacherSlots: Number(pending?.teacherSlots ?? 1),
            payment: {
              provider: "paystack",
              reference: resolvedReference,
            },
          }),
        });
        const json = await res.json();
        if (!res.ok || !json?.ok) {
          throw new Error(json?.error || "Failed to verify principal onboarding payment.");
        }

        window.sessionStorage.removeItem(PRINCIPAL_ONBOARDING_STORAGE_KEY);
        const redirectTo = String(json?.data?.redirectTo ?? "/principal/dashboard").trim() || "/principal/dashboard";
        window.location.assign(redirectTo);
      } catch (err: unknown) {
        setError(getErrorMessage(err, "Failed to complete principal onboarding after payment."));
      } finally {
        setOnboardingBusy(false);
      }
    })();
  }, [getToken, setError]);

  async function upgradeSlots() {
    setSlotUpgradeBusy(true);
    setError(null);
    try {
      const token = await getToken();
      if (!token) throw new Error("Session expired.");

      const res = await fetch("/api/principal/slots", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ addSlots }),
      });
      const json = await res.json();
      if (!res.ok || !json?.ok) throw new Error(json?.error || "Failed to add slots.");
      await loadDashboard();
    } catch (err: unknown) {
      setError(getErrorMessage(err, "Failed to add slots."));
    } finally {
      setSlotUpgradeBusy(false);
    }
  }

  async function payWithPaystack() {
    setPaystackBusy(true);
    setError(null);
    try {
      const { data } = await supabase.auth.getUser();
      const user = data.user;
      if (!user) throw new Error("Please login to continue.");

      const res = await fetch("/api/paystack/initialize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          user_id: user.id,
          email: user.email,
          currency: "NGN",
          tier: "pro",
        }),
      });

      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || "Payment init failed");
      if (!json.authorization_url) throw new Error("Missing checkout URL.");
      window.location.href = json.authorization_url;
    } catch (err: unknown) {
      setError(getErrorMessage(err, "Failed to start Paystack checkout."));
    } finally {
      setPaystackBusy(false);
    }
  }

  if (loading) return <PrincipalLoadingState />;
  if (forbidden) return <PrincipalForbiddenState />;
  if (onboardingRequired) return <PrincipalOnboardingRequiredState />;

  return (
    <div className="space-y-5 rounded-3xl bg-amber-50/70 p-4 md:p-6">
      <PrincipalPageHeader
        eyebrow="Billing & Payments"
        title="Principal Billing"
        description="Review your school plan, manage teacher slots, and process payments via Paystack."
      />

      {error ? (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
      ) : null}
      {onboardingBusy ? (
        <div className="rounded-xl border border-violet-200 bg-violet-50 px-4 py-3 text-sm text-violet-700">
          Verifying your payment and completing principal onboarding...
        </div>
      ) : null}

      {dashboard ? (
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-12">
          <div className="space-y-4 xl:col-span-5">
            <SectionCard title="Current plan" subtitle="Live billing snapshot for your school workspace.">
              <div className="space-y-2 rounded-xl border border-slate-200 bg-white p-4 text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-slate-600">Plan</span>
                  <span className="font-semibold text-slate-900">{dashboard.subscription.planName}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-600">Teacher slots</span>
                  <span className="font-semibold text-slate-900">{dashboard.subscription.slotLimit}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-600">Amount</span>
                  <span className="font-semibold text-violet-700">{toNaira(dashboard.subscription.amountPerCycle)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-600">Cycle</span>
                  <span className="font-semibold capitalize text-slate-900">{dashboard.subscription.billingCycle}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-600">Status</span>
                  <span className="font-semibold capitalize text-slate-900">{dashboard.subscription.status}</span>
                </div>
              </div>
            </SectionCard>

            <SectionCard title="Billing actions" subtitle="Increase capacity or trigger payment checkout.">
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min={1}
                    value={addSlots}
                    onChange={(e) => setAddSlots(Math.max(1, Number(e.target.value || 1)))}
                    className="w-24 rounded-lg border border-slate-200 bg-white px-2 py-2 text-sm outline-none focus:border-violet-500"
                  />
                  <button
                    onClick={upgradeSlots}
                    disabled={slotUpgradeBusy}
                    className="flex-1 rounded-lg bg-violet-600 px-3 py-2 text-sm font-semibold text-white hover:bg-violet-700 disabled:opacity-60"
                  >
                    {slotUpgradeBusy ? "Updating..." : "Add teacher slots"}
                  </button>
                </div>

                <button
                  onClick={payWithPaystack}
                  disabled={paystackBusy}
                  className="w-full rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-700 hover:bg-emerald-100 disabled:opacity-60"
                >
                  {paystackBusy ? "Redirecting..." : "Pay with Paystack"}
                </button>

                <p className="text-xs text-slate-500">
                  Existing backend checkout and verify flow is preserved. Billing remains one-time/manual without forced auto-renew logic.
                </p>
              </div>
            </SectionCard>
          </div>

          <div className="space-y-4 xl:col-span-7">
            <SectionCard title="Billing history" subtitle="Recent payment records for this school workspace.">
              <div className="overflow-x-auto">
                <table className="w-full min-w-[640px] text-sm">
                  <thead>
                    <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-500">
                      <th className="py-2">Amount</th>
                      <th className="py-2">Status</th>
                      <th className="py-2">Provider</th>
                      <th className="py-2">Reference</th>
                      <th className="py-2">Paid at</th>
                    </tr>
                  </thead>
                  <tbody>
                    {dashboard.billingHistory.map((item) => (
                      <tr key={item.id} className="border-b border-slate-100">
                        <td className="py-3 font-semibold text-slate-900">{toNaira(item.amount)}</td>
                        <td className="py-3">
                          <span className="rounded-full bg-slate-100 px-2 py-1 text-xs font-semibold capitalize text-slate-700">
                            {item.status}
                          </span>
                        </td>
                        <td className="py-3 capitalize text-slate-700">{item.provider}</td>
                        <td className="py-3 font-mono text-xs text-slate-600">{item.reference || "—"}</td>
                        <td className="py-3 text-slate-700">{formatDateOnly(item.paidAt)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </SectionCard>
          </div>
        </div>
      ) : null}
    </div>
  );
}