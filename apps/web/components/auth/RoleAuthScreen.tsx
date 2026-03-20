"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";

import AuthCard from "@/components/auth/AuthCard";
import AuthHeader from "@/components/auth/AuthHeader";
import AuthInput from "@/components/auth/AuthInput";
import SocialLoginButton from "@/components/auth/SocialLoginButton";
import type { AppRole } from "@/lib/auth/roles";
import { ROLE_CONTENT, ROLE_STORAGE_KEY } from "@/lib/auth/roles";
import { createBrowserSupabase } from "@/lib/supabase/browser";

type SocialProvider = "google" | "microsoft";

type RoleAuthScreenProps = {
  role: AppRole;
};

export default function RoleAuthScreen({ role }: RoleAuthScreenProps) {
  const router = useRouter();
  const supabase = useMemo(() => createBrowserSupabase(), []);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [emailLoading, setEmailLoading] = useState(false);
  const [socialLoading, setSocialLoading] = useState<SocialProvider | null>(null);
  const [syncingRole, setSyncingRole] = useState(false);

  const roleConfig = ROLE_CONTENT[role];
  const postLoginPath = role === "principal" ? "/principal/dashboard" : "/dashboard";

  const redirectAfterLogin = useCallback(() => {
    router.replace(postLoginPath);
    router.refresh();
  }, [postLoginPath, router]);

  const validateSessionRole = useCallback(
    async (userId: string) => {
      try {
        const {
          data: { user },
          error: userError,
        } = await supabase.auth.getUser();

        if (userError || !user || user.id !== userId) return;

        if (user.user_metadata?.app_role !== role) {
          const { error: updateError } = await supabase.auth.updateUser({
            data: {
              ...user.user_metadata,
              app_role: role,
            },
          });

          if (updateError) {
            console.warn("[Auth][session] Unable to sync role metadata", updateError);
          }
        }
      } catch (error: unknown) {
        console.warn("[Auth][session] Role validation failed", error);
      }
    },
    [role, supabase]
  );

  useEffect(() => {
    let active = true;

    localStorage.setItem(ROLE_STORAGE_KEY, role);

    (async () => {
      setSyncingRole(true);
      try {
        const {
          data: { session },
          error: sessionError,
        } = await supabase.auth.getSession();

        if (!active) return;
        if (sessionError) {
          console.error("[Auth][session] getSession failed", sessionError);
          return;
        }

        if (!session?.user) return;
        await validateSessionRole(session.user.id);
        if (!active) return;
        redirectAfterLogin();
      } catch (error: unknown) {
        if (!active) return;
        console.error("[Auth][session] Session bootstrap failed", error);
        setMessage(error instanceof Error ? error.message : "Unable to finish sign in.");
      } finally {
        if (active) setSyncingRole(false);
      }
    })();

    return () => {
      active = false;
    };
  }, [redirectAfterLogin, role, supabase, validateSessionRole]);

  async function handleSocialSignIn(provider: SocialProvider) {
    setMessage(null);
    setSocialLoading(provider);

    try {
      localStorage.setItem(ROLE_STORAGE_KEY, role);

      const redirectTo = `${window.location.origin}/auth/${role}`;
      const { error } = await supabase.auth.signInWithOAuth({
        provider: provider === "google" ? "google" : "azure",
        options: {
          redirectTo,
          queryParams: provider === "microsoft" ? { prompt: "select_account" } : undefined,
        },
      });

      if (error) {
        setMessage(error.message);
      }
    } catch (error: unknown) {
      setMessage(error instanceof Error ? error.message : "Unable to sign in right now.");
    } finally {
      setSocialLoading(null);
    }
  }

  async function handleEmailSignIn(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage(null);

    const cleanEmail = email.trim().toLowerCase();

    if (!cleanEmail || !password) {
      setMessage("Please enter both your email and password.");
      return;
    }

    setEmailLoading(true);

    try {
      localStorage.setItem(ROLE_STORAGE_KEY, role);

      const signInTimeoutMs = 15000;
      const signInPromise = supabase.auth.signInWithPassword({
        email: cleanEmail,
        password,
      });
      const timeoutPromise = new Promise<never>((_, reject) => {
        window.setTimeout(() => {
          reject(
            new Error(`Sign in timed out after ${Math.floor(signInTimeoutMs / 1000)} seconds.`)
          );
        }, signInTimeoutMs);
      });
      const signInResult = (await Promise.race([
        signInPromise,
        timeoutPromise,
      ])) as Awaited<ReturnType<typeof supabase.auth.signInWithPassword>>;

      const { data, error } = signInResult;
      console.info("[Auth][email] supabase.auth.signInWithPassword response", {
        data,
        error,
      });

      if (error) {
        const messageText = String(error.message || "Login failed.");
        setMessage(
          messageText.toLowerCase().includes("invalid login credentials")
            ? "Invalid email or password."
            : messageText
        );
        return;
      }

      if (!data?.session || !data.user) {
        setMessage("Sign in succeeded but no active session was returned. Please try again.");
        return;
      }

      await validateSessionRole(data.user.id);
      setMessage(`Signed in. Redirecting to ${postLoginPath}...`);
      redirectAfterLogin();
    } catch (error: unknown) {
      console.error("[Auth][email] Unable to sign in", error);
      setMessage(
        error instanceof Error && error.message
          ? error.message
          : "Unable to sign in right now."
      );
    } finally {
      setEmailLoading(false);
    }
  }

  const isBusy = emailLoading || Boolean(socialLoading) || syncingRole;

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#FAF9F6] p-4 sm:p-6">
      <AuthCard>
        <AuthHeader role={role} />

        <div className="mt-6 space-y-3">
          <SocialLoginButton
            provider="google"
            loading={socialLoading === "google"}
            onClick={() => handleSocialSignIn("google")}
          />
          <SocialLoginButton
            provider="microsoft"
            loading={socialLoading === "microsoft"}
            onClick={() => handleSocialSignIn("microsoft")}
          />
        </div>

        <div className="my-6 flex items-center gap-3">
          <div className="h-px flex-1 bg-slate-200" />
          <span className="text-xs uppercase tracking-[0.1em] text-slate-500">
            or continue with email
          </span>
          <div className="h-px flex-1 bg-slate-200" />
        </div>

        <form onSubmit={handleEmailSignIn} className="space-y-4">
          <AuthInput
            label="Email"
            type="email"
            placeholder="you@school.com"
            autoComplete="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            disabled={isBusy}
            required
          />
          <AuthInput
            label="Password"
            type="password"
            placeholder="Enter your password"
            autoComplete="current-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            disabled={isBusy}
            required
          />

          <button
            type="submit"
            disabled={isBusy}
            className="w-full rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 px-4 py-2.5 text-sm font-semibold text-white shadow-md shadow-indigo-300/50 transition hover:from-indigo-500 hover:to-violet-500 disabled:cursor-not-allowed disabled:opacity-65"
          >
            {emailLoading
              ? "Signing in..."
              : syncingRole
                ? "Finishing setup..."
                : `Sign in as ${roleConfig.label}`}
          </button>
        </form>

        {message ? (
          <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
            {message}
          </div>
        ) : null}

        <div className="mt-6 space-y-2 text-center text-sm text-slate-600">
          <p>
            Don&apos;t have an account?{" "}
            <Link
              className="font-medium text-indigo-700 hover:text-indigo-600"
              href="/select-role"
            >
              Choose role again
            </Link>
          </p>
          <p>
            Not your role?{" "}
            <Link
              className="font-medium text-indigo-700 hover:text-indigo-600"
              href="/select-role"
            >
              Change role
            </Link>
          </p>
        </div>
      </AuthCard>
    </main>
  );
}