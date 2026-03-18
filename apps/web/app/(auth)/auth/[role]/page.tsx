"use client";

import type { User } from "@supabase/supabase-js";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import AuthShell from "@/components/auth/AuthShell";
import { createBrowserSupabase } from "@/lib/supabase/browser";
import {
  getRoleHomePath,
  isAppRole,
  roleFromUserMetadata,
  ROLE_CONTENT,
  ROLE_STORAGE_KEY,
  type AppRole,
} from "@/lib/auth/roles";

type Mode = "login" | "signup";

function isMissingRoleColumnError(message: string) {
  const m = message.toLowerCase();
  return m.includes("column") && m.includes("role");
}

function isProfilePermissionError(message: string) {
  const m = message.toLowerCase();
  return (
    m.includes("row-level security") ||
    m.includes("permission denied") ||
    m.includes("jwt") ||
    m.includes("not authenticated")
  );
}

export default function RoleAuthPage() {
  const params = useParams<{ role: string }>();
  const roleParam = params?.role;
  const role: AppRole | null = isAppRole(roleParam) ? roleParam : null;

  const router = useRouter();
  const supabase = useMemo(() => createBrowserSupabase(), []);

  const [mode, setMode] = useState<Mode>("login");
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    if (!role) {
      router.replace("/select-role");
      return;
    }

    if (typeof window !== "undefined") {
      window.localStorage.setItem(ROLE_STORAGE_KEY, role);
    }

    let alive = true;
    supabase.auth.getSession().then(({ data }) => {
      if (!alive || !data.session) return;
      const userRole = roleFromUserMetadata(data.session.user.user_metadata, role) ?? role;
      router.replace(getRoleHomePath(userRole));
    });

    return () => {
      alive = false;
    };
  }, [role, router, supabase]);

  async function ensureProfile(user: User, preferredName: string) {
    if (!role) return;

    const profileBase = {
      id: user.id,
      email: user.email ?? "",
      full_name:
        preferredName.trim() ||
        ((user.user_metadata as Record<string, unknown> | null)?.full_name as string) ||
        "",
      updated_at: new Date().toISOString(),
    };

    const upsertWithRole = await supabase
      .from("profiles")
      .upsert({ ...profileBase, role });

    if (!upsertWithRole.error) return;

    if (isMissingRoleColumnError(upsertWithRole.error.message)) {
      const fallbackUpsert = await supabase.from("profiles").upsert(profileBase);
      if (fallbackUpsert.error && !isProfilePermissionError(fallbackUpsert.error.message)) {
        throw fallbackUpsert.error;
      }
      return;
    }

    if (!isProfilePermissionError(upsertWithRole.error.message)) {
      throw upsertWithRole.error;
    }
  }

  async function syncRole(user: User | null, preferredName: string) {
    if (!role) return;

    const activeUser = user ?? (await supabase.auth.getUser()).data.user;
    if (!activeUser) return;

    const nextMetadata: Record<string, unknown> = {
      ...(activeUser.user_metadata ?? {}),
      app_role: role,
    };

    if (preferredName.trim()) {
      nextMetadata.full_name = preferredName.trim();
    }

    const metadataResult = await supabase.auth.updateUser({ data: nextMetadata });
    if (metadataResult.error) {
      console.warn("Unable to update user metadata role:", metadataResult.error.message);
    }

    await ensureProfile(activeUser, preferredName);
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!role) return;

    setMsg(null);

    const cleanEmail = email.trim().toLowerCase();
    const cleanName = fullName.trim();

    if (!cleanEmail || !password || (mode === "signup" && !cleanName)) {
      setMsg("Please fill in all required fields.");
      return;
    }

    if (password.length < 6) {
      setMsg("Password must be at least 6 characters.");
      return;
    }

    if (typeof window !== "undefined") {
      window.localStorage.setItem(ROLE_STORAGE_KEY, role);
    }

    setLoading(true);
    try {
      if (mode === "signup") {
        const { data, error } = await supabase.auth.signUp({
          email: cleanEmail,
          password,
          options: {
            data: {
              full_name: cleanName,
              app_role: role,
            },
          },
        });

        if (error) {
          setMsg(error.message);
          return;
        }

        await syncRole(data.user, cleanName);

        if (data.session) {
          router.push(getRoleHomePath(role));
          router.refresh();
          return;
        }

        setMsg(
          "Account created. Please confirm your email if required, then log in to continue."
        );
        setMode("login");
        return;
      }

      const { data, error } = await supabase.auth.signInWithPassword({
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

      await syncRole(data.user, cleanName);

      setMsg("Logged in. Redirecting...");
      router.push(getRoleHomePath(role));
      router.refresh();
    } catch (err: unknown) {
      setMsg(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }

  if (!role) return null;

  const roleContent = ROLE_CONTENT[role];

  return (
    <AuthShell
      title={roleContent.authTitle}
      subtitle={roleContent.authSubtitle}
      topRight={
        <Link
          href="/select-role"
          className="rounded-2xl border border-violet-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:border-violet-300 hover:text-slate-900"
        >
          Change role
        </Link>
      }
    >
      <div className="inline-flex rounded-2xl border border-violet-100 bg-violet-50/60 p-1">
        <button
          type="button"
          onClick={() => setMode("login")}
          className={`rounded-xl px-4 py-2 text-sm font-semibold transition ${
            mode === "login"
              ? "bg-violet-700 text-white shadow-sm"
              : "text-slate-700 hover:bg-white"
          }`}
        >
          Log in
        </button>
        <button
          type="button"
          onClick={() => setMode("signup")}
          className={`rounded-xl px-4 py-2 text-sm font-semibold transition ${
            mode === "signup"
              ? "bg-violet-700 text-white shadow-sm"
              : "text-slate-700 hover:bg-white"
          }`}
        >
          Sign up
        </button>
      </div>

      {msg && (
        <div className="mt-5 rounded-2xl border border-violet-100 bg-violet-50/70 p-4 text-sm text-slate-700">
          {msg}
        </div>
      )}

      <form onSubmit={onSubmit} className="mt-6 space-y-4">
        {mode === "signup" && (
          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-700">
              Full name
            </label>
            <input
              type="text"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="Your full name"
              className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-slate-900 outline-none transition focus:border-violet-300 focus:ring-2 focus:ring-violet-400/30"
              disabled={loading}
              required
            />
          </div>
        )}

        <div>
          <label className="mb-1.5 block text-sm font-medium text-slate-700">Email</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@school.com"
            className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-slate-900 outline-none transition focus:border-violet-300 focus:ring-2 focus:ring-violet-400/30"
            disabled={loading}
            required
          />
        </div>

        <div>
          <label className="mb-1.5 block text-sm font-medium text-slate-700">Password</label>
          <div className="relative">
            <input
              type={showPassword ? "text" : "password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Minimum 6 characters"
              className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 pr-20 text-slate-900 outline-none transition focus:border-violet-300 focus:ring-2 focus:ring-violet-400/30"
              disabled={loading}
              required
              minLength={6}
            />
            <button
              type="button"
              onClick={() => setShowPassword((prev) => !prev)}
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-600 hover:bg-slate-50"
            >
              {showPassword ? "Hide" : "Show"}
            </button>
          </div>

          {mode === "login" && (
            <div className="mt-2 flex justify-end">
              <Link
                href="/forgot-password"
                className="text-sm font-medium text-violet-700 hover:text-violet-800"
              >
                Forgot password?
              </Link>
            </div>
          )}
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-2xl bg-violet-700 px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-violet-800 disabled:opacity-60"
        >
          {loading ? "Please wait..." : mode === "login" ? "Log in" : "Create account"}
        </button>
      </form>
    </AuthShell>
  );
}
