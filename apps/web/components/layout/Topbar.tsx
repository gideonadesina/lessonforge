"use client";

import { useState, useMemo } from "react";
import { createBrowserSupabase } from "@/lib/supabase/browser";

export default function Topbar({ userEmail }: { userEmail: string }) {
  const [loading, setLoading] = useState(false);

  // ✅ FIX: create supabase client once
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
      headers: {
        "Content-Type": "application/json",
      },
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
    <div className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm md:flex-row md:items-center md:justify-between">

      {/* LEFT */}
      <div>
        <div className="text-sm font-semibold text-slate-900">
          Welcome 👋
        </div>
        <div className="text-xs text-slate-500 truncate">
          {userEmail || "Signed in"}
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
  );
}
