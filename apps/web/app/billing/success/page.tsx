"use client";

import Link from "next/link";
import { Suspense, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { track } from "@/lib/analytics";
import { createBrowserSupabase } from "@/lib/supabase/browser";

function SuccessInner() {
  const supabase = useMemo(() => createBrowserSupabase(), []);
  const sp = useSearchParams();
  const reference = sp.get("reference");
  const flow = sp.get("flow");

  const [state, setState] = useState<"loading" | "ok" | "bad">("loading");
  const [msg, setMsg] = useState<string>("");

  useEffect(() => {
    (async () => {
      try {
        if (!reference) {
          setState("bad");
          setMsg("Missing payment reference.");
          return;
        }

        const endpoint =
          flow === "principal_onboarding"
            ? `/api/principal/payment/verify?reference=${encodeURIComponent(reference)}`
            : `/api/paystack/verify?reference=${encodeURIComponent(reference)}`;
        const {
          data: { session },
        } = await supabase.auth.getSession();
        const token = session?.access_token ?? "";
        if (!token) {
          throw new Error("Session expired. Please login again.");
        }

        const res = await fetch(endpoint, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const json = await res.json().catch(() => ({}));

        if (res.ok && json?.ok !== false) {
          setState("ok");
          setMsg("✅ Payment confirmed and activation complete.");
        } else {
          setState("bad");
          setMsg(json?.error || "⚠️ Could not confirm payment yet. Refresh in a minute.");
        }
      } catch (e: unknown) {
        setState("bad");
        setMsg(e instanceof Error ? e.message : "⚠️ Verification failed.");
      }
    })();
  }, [flow, reference, supabase]);

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex items-center justify-center p-6">
      <div className="w-full max-w-xl rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h1 className="text-2xl font-bold">Payment Status</h1>

        <p className="mt-3 text-slate-700">
          {state === "loading" ? "Confirming your subscription…" : msg}
        </p>

        <div className="mt-6 flex gap-3">
          <Link href="/principal" className="px-4 py-2 rounded-xl bg-slate-900 text-white font-semibold">
            Go to Principal Dashboard
          </Link>
          <Link href="/" className="px-4 py-2 rounded-xl border border-slate-300 bg-white font-semibold">
            Back to Home
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
  track("payment_success", { plan: "pro_monthly" });
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center p-6 text-slate-900">
          Loading…
        </div>
      }
    >
      <SuccessInner />
    </Suspense>
  );
}
