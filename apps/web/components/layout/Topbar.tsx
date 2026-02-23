"use client";

import { useState, useMemo } from "react";
import { createBrowserSupabase } from "@/lib/supabase/browser";

export default function Topbar({
  userEmail,
  onMenu,
}: {
  userEmail: string;
  onMenu: () => void;
}) {
  const [loading, setLoading] = useState(false);
  const [plansOpen, setPlansOpen] = useState(false);

  const supabase = useMemo(() => createBrowserSupabase(), []);

  async function logout() {
    try {
      setLoading(true);
      await supabase.auth.signOut();
      window.location.href = "/login";
    } finally {
      setLoading(false);
    }
  }

  async function upgradePlan(tier: "basic" | "pro") {
    const { data } = await supabase.auth.getUser();
    const user = data.user;

    if (!user) return;

    const res = await fetch("/api/paystack/initialize", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        user_id: user.id,
        email: user.email,
        currency: "NGN",
        tier,
      }),
    });

    const json = await res.json();

    if (!res.ok) {
      console.log(json);
      alert(json?.error || "Payment init failed");
      return;
    }

    window.location.href = json.authorization_url;
  }

  return (
    <>
      <div className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm md:flex-row md:items-center md:justify-between">
        {/* LEFT */}
        <div className="flex items-center gap-3 min-w-0">
          {/* ✅ Menu button for mobile/tablet */}
          <button
            onClick={onMenu}
            className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-white lg:hidden"
            aria-label="Open menu"
          >
            <span className="text-xl leading-none">☰</span>
          </button>

          <div className="min-w-0">
            <div className="text-sm font-semibold text-slate-900">Welcome 👋</div>
            <div className="text-xs text-slate-500 truncate">
              {userEmail || "Signed in"}
            </div>
          </div>
        </div>

        {/* CENTER */}
        <div className="relative w-full md:w-72">
          <input
            placeholder="Search lessons, topics..."
            className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm outline-none focus:border-violet-400"
          />
        </div>

        {/* RIGHT */}
        <div className="flex items-center gap-2">
          {/* ✅ Mobile: show Upgrade button that opens a modal (works on iOS) */}
          <button
            onClick={() => setPlansOpen(true)}
            className="sm:hidden rounded-xl bg-slate-900 text-white px-4 py-2 text-sm font-semibold hover:bg-slate-800"
          >
            Upgrade
          </button>

          {/* Desktop/tablet (sm+) */}
          <button
            onClick={() => upgradePlan("basic")}
            className="hidden sm:inline-flex rounded-xl border bg-white px-4 py-2 text-sm font-semibold hover:bg-slate-50"
          >
            Basic ₦2,000/mo
          </button>

          <button
            onClick={() => upgradePlan("pro")}
            className="hidden sm:inline-flex rounded-xl bg-slate-900 text-white px-4 py-2 text-sm font-semibold hover:bg-slate-800"
          >
            Pro ₦5,000/mo
          </button>

          <button
            onClick={logout}
            disabled={loading}
            className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-800 hover:bg-slate-100 disabled:opacity-60"
          >
            {loading ? "Logging out..." : "Logout"}
          </button>
        </div>
      </div>

      {/* ✅ Upgrade Modal (mobile) */}
      {plansOpen && (
        <>
          <button
            className="fixed inset-0 z-50 bg-black/40"
            aria-label="Close upgrade modal"
            onClick={() => setPlansOpen(false)}
          />
          <div className="fixed left-0 right-0 bottom-0 z-50 rounded-t-3xl bg-white p-4 shadow-xl">
            <div className="flex items-center justify-between">
              <div className="text-sm font-semibold text-slate-900">Upgrade Plan</div>
              <button
                className="h-10 w-10 rounded-xl border border-slate-200 bg-white"
                onClick={() => setPlansOpen(false)}
                aria-label="Close"
              >
                ✕
              </button>
            </div>

            <div className="mt-3 grid gap-2">
              <button
                onClick={() => upgradePlan("basic")}
                className="w-full rounded-xl border bg-white px-4 py-3 text-sm font-semibold hover:bg-slate-50"
              >
                Basic ₦2,000/mo
              </button>
              <button
                onClick={() => upgradePlan("pro")}
                className="w-full rounded-xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white hover:bg-slate-800"
              >
                Pro ₦5,000/mo
              </button>
            </div>
          </div>
        </>
      )}
    </>
  );
}