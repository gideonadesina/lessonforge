"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { createClient } from "../lib/supabase/browser";

type Mode = "login" | "signup";

export default function LoginPage() {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);

  const [mode, setMode] = useState<Mode>("login");
  const [fullName, setFullName] = useState(""); // ✅ NEW
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function ensureProfile() {
    const { data } = await supabase.auth.getUser();
    const user = data?.user;
    if (!user) return;

    await supabase.from("profiles").upsert({
      id: user.id,
      email: user.email,
      full_name: (user.user_metadata as any)?.full_name ?? "",
      updated_at: new Date().toISOString(),
    });
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);

    const cleanEmail = email.trim().toLowerCase();
    const cleanName = fullName.trim();

    if (!cleanEmail || !password || (mode === "signup" && !cleanName)) {
      setMsg("Please fill in all fields.");
      return;
    }
    if (password.length < 6) {
      setMsg("Password must be at least 6 characters.");
      return;
    }

    setLoading(true);
    try {
      if (mode === "signup") {
        const { error } = await supabase.auth.signUp({
          email: cleanEmail,
          password,
          options: {
            data: { full_name: cleanName }, // ✅ KEY: goes to raw_user_meta_data
          },
        });

        if (error) {
          setMsg(error.message);
          return;
        }

        // optional but recommended: ensure profiles row exists (covers edge cases)
        await ensureProfile();

        setMsg("Account created ✅ You can log in now.");
        setMode("login");
        return;
      }

      // Login
      const { error } = await supabase.auth.signInWithPassword({
        email: cleanEmail,
        password,
      });

       if (error) {
        const text = String(error.message || "Login failed.");
        if (text.toLowerCase().includes("email not confirmed")) {
          setMsg(
            "Email not confirmed. Please check your inbox or disable email confirmation in Supabase Auth settings for smoother onboarding."
          );
        } else {
          setMsg(text);
        }
        return;
      }

      // After login, ensure profile exists (good for old users)
      await ensureProfile();

      setMsg("Logged in ✅ Redirecting…");
      router.push("/dashboard");
      router.refresh();
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

          <Link href="/" className="text-sm text-slate-600 hover:text-slate-900 transition">
            Back to Home
          </Link>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-10 lg:py-16">
        <div className="grid lg:grid-cols-2 gap-10 items-start">
           <section className="w-full">
            <div className="max-w-md">
              <h1 className="text-3xl font-bold tracking-tight text-slate-900">
                {mode === "login" ? "Welcome back" : "Create your account"}
              </h1>
              <p className="text-sm text-slate-600 mt-2">
                {mode === "login"
                  ? "Sign in to access your dashboard and saved lesson library."
                  : "Create an account to save lessons, export PDF/PPTX, and build your private library."}
              </p>

               <div className="mt-6 inline-flex rounded-2xl border bg-white p-1 shadow-sm">
                <button
                  type="button"
                  onClick={() => setMode("login")}
                  className={`px-4 py-2 rounded-xl text-sm font-medium transition ${
                    mode === "login" ? "bg-slate-900 text-white" : "text-slate-700 hover:bg-slate-50"
                  }`}
                >
                  Log in
                </button>
                <button
                  type="button"
                  onClick={() => setMode("signup")}
                  className={`px-4 py-2 rounded-xl text-sm font-medium transition ${
                    mode === "signup" ? "bg-slate-900 text-white" : "text-slate-700 hover:bg-slate-50"
                  }`}
                >
                  Sign up
                </button>
              </div>

               {msg && (
                <div className="mt-5 rounded-2xl border bg-white p-4 text-sm text-slate-700">{msg}</div>
              )}

              <form onSubmit={onSubmit} className="mt-6 space-y-4">
                {/* ✅ Full Name only in Sign up */}
                {mode === "signup" && (
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Full name</label>
                    <input
                      type="text"
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      placeholder="Gideon Adesina"
                      className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-slate-900 placeholder:text-slate-400 outline-none focus:ring-2 focus:ring-indigo-500"
                      disabled={loading}
                      required
                    />
                  </div>
                )}

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

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Password</label>
                  <div className="relative">
                    <input
                      type={showPassword ? "text" : "password"}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Minimum 6 characters"
                      className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-slate-900 placeholder:text-slate-400 outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500"
                      disabled={loading}
                      required
                      minLength={6}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((v) => !v)}
                      disabled={loading}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-xs px-2 py-1 rounded-lg border bg-white hover:bg-slate-50"
                    >
                      {showPassword ? "Hide" : "Show"}
                    </button>
                  </div>

                  <div className="mt-1 text-xs text-slate-500">Minimum 6 characters.</div>
                </div>

                {mode === "login" && (
                  <div className="flex justify-end">
                    <button
                      type="button"
                      className="text-sm text-indigo-600 hover:text-indigo-700"
                      onClick={() =>
                        setMsg("Forgot password flow coming soon. For now, reset in Supabase Auth or add password reset later.")
                      }
                    >
                      Forgot password?
                    </button>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full rounded-2xl bg-slate-900 text-white px-5 py-3 font-semibold shadow-sm hover:bg-slate-800 disabled:opacity-60"
                >
                  {loading ? "Please wait…" : mode === "login" ? "Log in" : "Create account"}
                </button>

                  <div className="pt-4 text-xs text-slate-500 leading-relaxed">
                  <div className="font-medium text-slate-700">Data privacy:</div>
                  We don’t sell your data. Your saved lessons are private to your account. Avoid entering student names or sensitive personal information.
                  <div className="mt-2">🔒 Secure authentication powered by Supabase • ✅ Exports: PDF & PPTX</div>
                </div>
              </form>
            </div>
          </section>

          <aside className="hidden lg:block">
            <div className="rounded-[2rem] border bg-white p-8 shadow-sm">
              <div className="text-sm font-semibold text-slate-900">What you get with LessonForge</div>
              <p className="text-sm text-slate-600 mt-2">
                Built for teachers: structured output, classroom-ready resources, and fast exports.
              </p>

              <div className="mt-6 space-y-4">
                <div className="rounded-2xl border p-4">
                  <div className="font-semibold text-slate-900">Lesson Notes</div>
                  <div className="text-sm text-slate-600">Copy-ready notes aligned to your subject, topic, grade, and curriculum.</div>
                </div>

                <div className="rounded-2xl border p-4">
                  <div className="font-semibold text-slate-900">Slides + Quizzes</div>
                  <div className="text-sm text-slate-600">PPTX slide outline + MCQ/theory questions for quick assessment.</div>
                </div>

                <div className="rounded-2xl border p-4">
                  <div className="font-semibold text-slate-900">Private Library</div>
                  <div className="text-sm text-slate-600">Save lessons to reuse, improve, and standardize teaching quality.</div>
                </div>
              </div>
            </div>
          </aside>
        </div>
      </main>
    </div>
  );
}
