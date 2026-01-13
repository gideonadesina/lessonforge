"use client";

import { useState } from "react";
import { supabase } from "../lib/supabaseclient";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const router = useRouter();
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);
    setLoading(true);

    try {
      const fn =
        mode === "login"
          ? supabase.auth.signInWithPassword
          : supabase.auth.signUp;

      const { error } = await fn({ email, password });

      if (error) {
        setMsg(error.message);
        return;
      }

     if (mode === "signup") {
  setMsg("Account created. Check your email if confirmation is enabled, then log in.");
  setMode("login");
  return;
}

setMsg("Logged in!");
router.push("/dashboard");
router.refresh();
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="max-w-md mx-auto p-6 space-y-4">
      <h1 className="text-2xl font-semibold">LessonForge</h1>

      <div className="flex gap-2">
        <button
          className={`px-3 py-2 rounded-xl border ${mode === "login" ? "font-semibold" : ""}`}
          onClick={() => setMode("login")}
        >
          Log in
        </button>
        <button
          className={`px-3 py-2 rounded-xl border ${mode === "signup" ? "font-semibold" : ""}`}
          onClick={() => setMode("signup")}
        >
          Sign up
        </button>
      </div>

      <form onSubmit={onSubmit} className="space-y-3">
        <input
          className="w-full border rounded-xl p-3"
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
        <input
          className="w-full border rounded-xl p-3"
          type="password"
          placeholder="Password (min 6 chars)"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          minLength={6}
        />

        <button
          disabled={loading}
          className="w-full px-4 py-3 rounded-xl border font-semibold"
          type="submit"
        >
          {loading ? "Please wait..." : mode === "login" ? "Log in" : "Create account"}
        </button>
      </form>

      {msg && <div className="text-sm opacity-80">{msg}</div>}
    </div>
  );
}
