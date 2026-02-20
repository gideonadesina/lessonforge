"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createBrowserSupabase } from "@/lib/supabase/browser";

export default function ResetPasswordPage() {
  const router = useRouter();
  const supabase = useMemo(() => createBrowserSupabase(), []);

  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);

    if (password.length < 6) {
      setMsg("Password must be at least 6 characters.");
      return;
    }
    if (password !== confirm) {
      setMsg("Passwords do not match.");
      return;
    }

    setLoading(true);
    try {
      // If the reset link is valid, Supabase creates a session for this browser.
      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData.session) {
        setMsg("Invalid or expired reset link. Please request a new reset link.");
        return;
      }

      const { error } = await supabase.auth.updateUser({ password });
      if (error) {
        setMsg(error.message);
        return;
      }

      setMsg("Password updated ✅ Redirecting to login…");
      setTimeout(() => router.push("/login"), 900);
    } catch (err: any) {
      setMsg(String(err?.message ?? err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="border-b bg-white/80 backdrop-blur sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-600 to-violet-600 shadow-md" />
            <div className="leading-tight">
              <div className="font-semibold text-slate-900">LessonForge</div>
              <div className="text-[11px] text-slate-500">AI Lesson Planning</div>
            </div>
          </Link>

          <Link href="/login" className="text-sm text-slate-600 hover:text-slate-900 transition">
            Back to Login
          </Link>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-10 lg:py-16">
        <section className="max-w-md">
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">Reset password</h1>
          <p className="text-sm text-slate-600 mt-2">Set a new password to regain access.</p>

          {msg && (
            <div className="mt-5 rounded-2xl border bg-white p-4 text-sm text-slate-700">{msg}</div>
          )}

          <form onSubmit={onSubmit} className="mt-6 space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">New password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Minimum 6 characters"
                className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-slate-900 placeholder:text-slate-400 outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500"
                disabled={loading}
                required
                minLength={6}
              />
              <div className="mt-1 text-xs text-slate-500">Minimum 6 characters.</div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Confirm password</label>
              <input
                type="password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                placeholder="Re-type password"
                className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-slate-900 placeholder:text-slate-400 outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500"
                disabled={loading}
                required
                minLength={6}
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-2xl bg-slate-900 text-white px-5 py-3 font-semibold shadow-sm hover:bg-slate-800 disabled:opacity-60"
            >
              {loading ? "Updating…" : "Update password"}
            </button>

            <div className="text-sm text-slate-600">
              Need a new link?{" "}
              <Link href="/forgot-password" className="text-indigo-600 hover:text-indigo-700">
                Request reset link
              </Link>
            </div>
          </form>
        </section>
      </main>
    </div>
  );
}