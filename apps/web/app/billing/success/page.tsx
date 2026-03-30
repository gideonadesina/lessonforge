"use client";

import Link from "next/link";
import { Suspense, useEffect, useMemo, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { track } from "@/lib/analytics";
import { createBrowserSupabase } from "@/lib/supabase/browser";

type VerifyState = "loading" | "ok" | "bad";

function SuccessInner() {
  const sp = useSearchParams();
  const router = useRouter();
  const reference = sp.get("reference");
  const flow = sp.get("flow");

  const [state, setState] = useState<VerifyState>("loading");
  const [msg, setMsg] = useState("Confirming your payment...");

  const [credits, setCredits] = useState<number | null>(null);
  const [plan, setPlan] = useState<string | null>(null);

  const supabase = useMemo(() => createBrowserSupabase(), []);

  const isPrincipalFlow = flow === "principal_onboarding";

  const endpoint = useMemo(() => {
    if (!reference) return null;

    return isPrincipalFlow
      ? `/api/principal/payment/verify?reference=${encodeURIComponent(reference)}`
      : `/api/paystack/verify?reference=${encodeURIComponent(reference)}`;
  }, [isPrincipalFlow, reference]);

  // 🔥 VERIFY PAYMENT
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
          setMsg("🎉 Payment successful!");

          // 🔥 Fetch updated profile
          const {
            data: { user },
          } = await supabase.auth.getUser();

          if (user) {
            const { data: profile } = await supabase
              .from("profiles")
              .select("credits_balance, plan")
              .eq("id", user.id)
              .single();

            if (profile) {
              setCredits(profile.credits_balance);
              setPlan(profile.plan);
            }
          }
        } else {
          setState("bad");
          setMsg(
            json?.error ||
              "⚠️ Could not confirm payment yet. Please refresh shortly."
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
  }, [endpoint, isPrincipalFlow, reference, supabase]);

  // 🔥 TRACK
  useEffect(() => {
    if (state !== "ok") return;

    track("payment_success", {
      reference,
      flow: flow ?? "default",
    });
  }, [flow, reference, state]);

  // 🔥 AUTO REDIRECT
  useEffect(() => {
    if (state !== "ok") return;

    const timer = setTimeout(() => {
      router.push(isPrincipalFlow ? "/principal/dashboard" : "/dashboard");
    }, 5000);

    return () => clearTimeout(timer);
  }, [state, router, isPrincipalFlow]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 p-6 text-slate-900">
      <div className="w-full max-w-xl rounded-2xl border border-slate-200 bg-white p-7 shadow-sm">

        {/* TITLE */}
        <h1 className="text-2xl font-bold">Payment Status</h1>

        {/* STATUS */}
        <p className="mt-3 text-slate-700">
          {state === "loading" ? "Confirming your payment..." : msg}
        </p>

        {/* 🎉 SUCCESS DETAILS */}
        {state === "ok" && !isPrincipalFlow && (
          <div className="mt-5 rounded-xl border border-green-100 bg-green-50 p-4">
            <p className="text-sm font-semibold text-green-700">
              🎉 Your account has been updated
            </p>

            {credits !== null && (
              <p className="mt-2 text-sm text-slate-700">
                New balance:{" "}
                <span className="font-bold text-slate-900">
                  {credits} credits
                </span>
              </p>
            )}

            {plan && (
              <p className="text-sm text-slate-600">
                Plan:{" "}
                <span className="font-semibold capitalize">{plan}</span>
              </p>
            )}
          </div>
        )}

        {/* ACTIONS */}
        <div className="mt-6 flex flex-wrap gap-3">
          <Link
            href={isPrincipalFlow ? "/principal/dashboard" : "/dashboard"}
            className="rounded-xl bg-slate-900 px-4 py-2 font-semibold text-white"
          >
            Go to Dashboard
          </Link>

          <Link
            href="/"
            className="rounded-xl border border-slate-300 bg-white px-4 py-2 font-semibold"
          >
            Back to home
          </Link>
        </div>

        {/* REF */}
        {reference && (
          <div className="mt-4 text-xs text-slate-500">
            Reference: <span className="font-mono">{reference}</span>
          </div>
        )}

        {/* AUTO REDIRECT TEXT */}
        {state === "ok" && (
          <p className="mt-3 text-xs text-slate-500">
            Redirecting you to your dashboard...
          </p>
        )}
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