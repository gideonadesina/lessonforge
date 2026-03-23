"use client";

import Link from "next/link";
import { Suspense, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { track } from "@/lib/analytics";

type VerifyState = "loading" | "ok" | "bad";

function SuccessInner() {
  const sp = useSearchParams();
  const reference = sp.get("reference");
  const flow = sp.get("flow");

  const [state, setState] = useState<VerifyState>("loading");
  const [msg, setMsg] = useState("Confirming your payment...");

  const isPrincipalFlow = flow === "principal_onboarding";

  const endpoint = useMemo(() => {
    if (!reference) return null;

    return isPrincipalFlow
      ? `/api/principal/payment/verify?reference=${encodeURIComponent(reference)}`
      : `/api/paystack/verify?reference=${encodeURIComponent(reference)}`;
  }, [isPrincipalFlow, reference]);

  useEffect(() => {
    let active = true;

    async function verifyPayment() {
      if (!reference || !endpoint) {
        if (!active) return;
        setState("bad");
        setMsg("Missing payment reference.");
        return;
      }

      try {
        const res = await fetch(endpoint, {
          method: "GET",
          cache: "no-store",
        });

        const json = await res.json().catch(() => ({}));

        if (!active) return;

        if (res.ok && json?.ok !== false) {
          setState("ok");
          setMsg(
            isPrincipalFlow
              ? "✅ Payment confirmed and principal workspace activated."
              : "✅ Payment confirmed successfully."
          );
        } else {
          setState("bad");
          setMsg(
            json?.error || "⚠️ Could not confirm payment yet. Please refresh shortly."
          );
        }
      } catch (e: unknown) {
        if (!active) return;
        setState("bad");
        setMsg(e instanceof Error ? e.message : "⚠️ Verification failed.");
      }
    }

    verifyPayment();

    return () => {
      active = false;
    };
  }, [endpoint, isPrincipalFlow, reference]);

  useEffect(() => {
    if (state !== "ok") return;

    track("payment_success", {
      reference,
      flow: flow ?? "default",
    });
  }, [flow, reference, state]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 p-6 text-slate-900">
      <div className="w-full max-w-xl rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h1 className="text-2xl font-bold">Payment Status</h1>

        <p className="mt-3 text-slate-700">
          {state === "loading" ? "Confirming your payment..." : msg}
        </p>

        <div className="mt-6 flex flex-wrap gap-3">
          {isPrincipalFlow ? (
            <Link
              href="/principal/dashboard"
              className="rounded-xl bg-slate-900 px-4 py-2 font-semibold text-white"
            >
              Go to Principal Dashboard
            </Link>
          ) : (
            <Link
              href="/dashboard"
              className="rounded-xl bg-slate-900 px-4 py-2 font-semibold text-white"
            >
              Go to Dashboard
            </Link>
          )}

          <Link
            href="/"
            className="rounded-xl border border-slate-300 bg-white px-4 py-2 font-semibold"
          >
            Back to home
          </Link>
        </div>

        {reference ? (
          <div className="mt-4 text-xs text-slate-500">
            Reference: <span className="font-mono">{reference}</span>
          </div>
        ) : null}
      </div>
    </div>
  );
}

export default function BillingSuccessPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center p-6 text-slate-900">
          Loading…
        </div>
      }
    >
      <SuccessInner />
    </Suspense>
  );
}