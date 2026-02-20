"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { createBrowserSupabase } from "@/lib/supabase/browser";

export default function ForgotPasswordPage() {
  const supabase = useMemo(() => createBrowserSupabase(), []);

  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);

    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail) {
      setMsg("Please enter your email.");
      return;
    }

    setLoading(true);
    try {
      const redirectTo = `${window.location.origin}/reset-password`;

      const { error } = await supabase.auth.resetPasswordForEmail(cleanEmail, {
        redirectTo,
      });

      if (error) {
        setMsg(error.message);
        return;
      }

      setMsg("Reset link sent ✅ Check your email inbox (and spam folder).");
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
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">Forgot password</h1>
          <p className="text-sm text-slate-600 mt-2">
            Enter your email and we’ll send you a reset link.
          </p>

          {msg && (
            <div className="mt-5 rounded-2xl border bg-white p-4 text-sm text-slate-700">{msg}</div>
          )}

          <form onSubmit={onSubmit} className="mt-6 space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="your.email@school.com"
                className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-slate-900 placeholder:text-slate-400 outline-none focus:ring-2 focus:ring-indigo-500"
                disabled={loading}
                required
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-2xl bg-slate-900 text-white px-5 py-3 font-semibold shadow-sm hover:bg-slate-800 disabled:opacity-60"
            >
              {loading ? "Sending…" : "Send reset link"}
            </button>

            <div className="text-sm text-slate-600">
              Remembered it?{" "}
              <Link href="/login" className="text-indigo-600 hover:text-indigo-700">
                Go back to login
              </Link>
            </div>
          </form>
        </section>
      </main>
    </div>
  );
}