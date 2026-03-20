"use client";

import Link from "next/link";
import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { track } from "@/lib/analytics";
import { createBrowserSupabase } from "@/lib/supabase/browser";

function SuccessInner() {
  const sp = useSearchParams();
  const reference = sp.get("reference");

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

        const supabase = createBrowserSupabase();
        const { data } = await supabase.auth.getSession();
        const token = data.session?.access_token;
        if (!token) {
          setState("bad");
          setMsg("Your session expired. Please log in and verify from your dashboard.");
          return;
        }

        const res = await fetch(`/api/paystack/verify?reference=${encodeURIComponent(reference)}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const json = await res.json().catch(() => ({}));

        if (res.ok) {
          setState("ok");
          setMsg("Payment verified successfully. Your plan and credits have been updated.");
        } else {
          setState("bad");
          setMsg(json?.error || "Could not confirm payment yet. Refresh in a minute.");
        }
      } catch (e: unknown) {
        const message = e instanceof Error ? e.message : "Verification failed.";
        setState("bad");
        setMsg(message);
      }
    })();
  }, [reference]);

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex items-center justify-center p-6">
      <div className="w-full max-w-xl rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h1 className="text-2xl font-bold">Payment Status</h1>

        <p className="mt-3 text-slate-700">
          {state === "loading" ? "Confirming your payment…" : msg}
        </p>

        <div className="mt-6 flex gap-3">
          <Link href="/dashboard" className="px-4 py-2 rounded-xl bg-slate-900 text-white font-semibold">
            Go to Dashboard
          </Link>
          <Link href="/" className="px-4 py-2 rounded-xl border border-slate-300 bg-white font-semibold">
            Generate Lesson
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
  track("payment_success", { flow: "manual_prepaid" });
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
