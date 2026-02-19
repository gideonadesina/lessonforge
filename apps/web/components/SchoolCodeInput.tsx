"use client";

import { useMemo, useState } from "react";
import { createBrowserSupabase } from "@/lib/supabase/browser";

export default function SchoolCodeInput() {
  const supabase = useMemo(() => createBrowserSupabase(), []);

  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function joinSchool() {
    const cleaned = code.trim().toUpperCase();
    if (!cleaned) return;

    setLoading(true);
    setMessage(null);

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      const token = session?.access_token;
      if (!token) {
        setMessage("Session expired. Please login again.");
        return;
      }

      const res = await fetch("/api/schools/join", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ code: cleaned }),
      });

      const json = await res.json();

      if (!res.ok || json?.ok === false) {
        setMessage(json?.error || "Invalid school code");
        return;
      }

      setMessage("✅ Joined school successfully!");
      setTimeout(() => window.location.reload(), 800);
    } catch (e: any) {
      setMessage(e?.message || "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <h3 className="text-base font-bold text-slate-900">Join School License</h3>
      <p className="mt-1 text-sm text-slate-600">
        Enter the code from your headteacher/admin.
      </p>

      <div className="mt-4 flex gap-2">
        <input
          value={code}
          onChange={(e) => setCode(e.target.value)}
          placeholder="e.g. GHA-KAD-2026"
          className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-violet-400"
        />

        <button
          onClick={joinSchool}
          disabled={loading || !code.trim()}
          className="rounded-xl bg-violet-600 px-4 py-2 text-sm font-semibold text-white hover:bg-violet-700 disabled:opacity-60"
        >
          {loading ? "Joining..." : "Join"}
        </button>
      </div>

      {message ? (
        <div className="mt-3 text-sm text-slate-700">{message}</div>
      ) : (
        <div className="mt-3 text-xs text-slate-500">
          Tip: confirm spelling/case from your admin.
        </div>
      )}
    </div>
  );
}
