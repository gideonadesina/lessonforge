"use client";
 
import type { User } from "@supabase/supabase-js";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from "react";
 
import AuthCard from "@/components/auth/AuthCard";
import AuthHeader from "@/components/auth/AuthHeader";
import AuthInput from "@/components/auth/AuthInput";
import SocialLoginButton from "@/components/auth/SocialLoginButton";
import type { AppRole } from "@/lib/auth/roles";
import { ROLE_CONTENT, ROLE_STORAGE_KEY } from "@/lib/auth/roles";
import { createBrowserSupabase } from "@/lib/supabase/browser";
 
type SocialProvider = "google" | "microsoft";
type Mode = "login" | "signup";
type AuthEvent =
  | "SIGNED_IN"
  | "SIGNED_OUT"
  | "TOKEN_REFRESHED"
  | "USER_UPDATED"
  | "PASSWORD_RECOVERY"
  | "INITIAL_SESSION";
 
type RoleAuthScreenProps = {
  role: AppRole;
};

const OAUTH_INTENT_STORAGE_KEY = "lessonforge:oauth-intent";
const OAUTH_INTENT_MAX_AGE_MS = 10 * 60 * 1000;

type OAuthIntent = {
  role: AppRole;
  createdAt: number;
};
 
function isMissingRoleColumnError(message: string) {
  const normalized = message.toLowerCase();
  return normalized.includes("column") && normalized.includes("role");
}
 
function isProfilePermissionError(message: string) {
  const normalized = message.toLowerCase();
  return (
    normalized.includes("row-level security") ||
    normalized.includes("permission denied") ||
    normalized.includes("jwt") ||
    normalized.includes("not authenticated")
  );
}

function readOAuthIntent(): OAuthIntent | null {
  if (typeof window === "undefined") return null;

  const raw = window.localStorage.getItem(OAUTH_INTENT_STORAGE_KEY);
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw) as Partial<OAuthIntent>;
    const isRoleValid = parsed.role === "teacher" || parsed.role === "principal";
    const createdAt = Number(parsed.createdAt);

    if (!isRoleValid || !Number.isFinite(createdAt)) {
      window.localStorage.removeItem(OAUTH_INTENT_STORAGE_KEY);
      return null;
    }

    if (Date.now() - createdAt > OAUTH_INTENT_MAX_AGE_MS) {
      window.localStorage.removeItem(OAUTH_INTENT_STORAGE_KEY);
      return null;
    }

    return { role: parsed.role, createdAt };
  } catch {
    window.localStorage.removeItem(OAUTH_INTENT_STORAGE_KEY);
    return null;
  }
}

function writeOAuthIntent(role: AppRole) {
  if (typeof window === "undefined") return;
  const payload: OAuthIntent = {
    role,
    createdAt: Date.now(),
  };
  window.localStorage.setItem(OAUTH_INTENT_STORAGE_KEY, JSON.stringify(payload));
}

function clearOAuthIntent() {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(OAUTH_INTENT_STORAGE_KEY);
}
 
export default function RoleAuthScreen({ role }: RoleAuthScreenProps) {
  const router = useRouter();
  const supabase = useMemo(() => createBrowserSupabase(), []);
 
  const [mode, setMode] = useState<Mode>("login");
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [emailLoading, setEmailLoading] = useState(false);
  const [socialLoading, setSocialLoading] = useState<SocialProvider | null>(null);
  const [syncingRole, setSyncingRole] = useState(false);
 
  const hasHandledSessionRef = useRef(false);
  const shouldHandleOAuthSessionRef = useRef(false);
 
  const roleConfig = ROLE_CONTENT[role];
 
  const redirectAfterLogin = useCallback(
    (targetRole: AppRole = role) => {
      router.replace(ROLE_CONTENT[targetRole].postAuthPath);
      router.refresh();
    },
    [role, router]
  );
 
  const ensureProfile = useCallback(
    async (user: User, preferredName: string, preferredRole: AppRole) => {
      const metadata = (user.user_metadata ?? {}) as Record<string, unknown>;
      const profileBase = {
        id: user.id,
        email: user.email ?? "",
        full_name: preferredName.trim() || (typeof metadata.full_name === "string" ? metadata.full_name : ""),
        updated_at: new Date().toISOString(),
      };
 
      const upsertWithRole = await supabase.from("profiles").upsert({
        ...profileBase,
        role: preferredRole,
      });
 
      if (!upsertWithRole.error) return;
 
      if (isMissingRoleColumnError(upsertWithRole.error.message)) {
        const fallback = await supabase.from("profiles").upsert(profileBase);
        if (fallback.error && !isProfilePermissionError(fallback.error.message)) {
          throw fallback.error;
        }
        return;
      }
 
      if (!isProfilePermissionError(upsertWithRole.error.message)) {
        throw upsertWithRole.error;
      }
    },
    [supabase]
  );
 
  const syncRoleForUser = useCallback(
    async (user: User, preferredName: string, preferredRole: AppRole) => {
      const nextMetadata: Record<string, unknown> = {
        ...(user.user_metadata ?? {}),
        app_role: preferredRole,
      };
 
      if (preferredName.trim()) {
        nextMetadata.full_name = preferredName.trim();
      }
 
      const { error: updateError } = await supabase.auth.updateUser({
        data: nextMetadata,
      });
 
      if (updateError) {
        console.warn("Unable to sync role metadata:", updateError.message);
      }
 
      await ensureProfile(user, preferredName, preferredRole);
    },
    [ensureProfile, supabase]
  );
 
  const syncUserRoleAndRedirect = useCallback(
    async (userId?: string) => {
      if (hasHandledSessionRef.current) return;
      hasHandledSessionRef.current = true;
      setSyncingRole(true);
      setMessage(null);
 
      try {
        const storedRole = localStorage.getItem(ROLE_STORAGE_KEY);
        const effectiveRole: AppRole =
          storedRole === "principal" || storedRole === "teacher" ? storedRole : role;
 
        const {
          data: { user },
          error: userError,
        } = await supabase.auth.getUser();
 
        if (userError) throw userError;
        if (!user || (userId && user.id !== userId)) {
          hasHandledSessionRef.current = false;
          return;
        }
 
        await syncRoleForUser(user, "", effectiveRole);
 
        localStorage.setItem(ROLE_STORAGE_KEY, effectiveRole);
        clearOAuthIntent();
        redirectAfterLogin(effectiveRole);
      } catch (error: unknown) {
        hasHandledSessionRef.current = false;
        setMessage(error instanceof Error ? error.message : "Unable to finish sign in.");
      } finally {
        setSyncingRole(false);
      }
    },
    [role, redirectAfterLogin, supabase, syncRoleForUser]
  );
 
  useEffect(() => {
    let active = true;
 
    localStorage.setItem(ROLE_STORAGE_KEY, role);
    const oauthIntent = readOAuthIntent();
    const searchParams = new URLSearchParams(window.location.search);
    const hasOAuthCallbackParams =
      searchParams.has("code") ||
      searchParams.has("access_token") ||
      searchParams.has("refresh_token") ||
      searchParams.has("provider_token");
    const shouldHandleOAuthSession =
      (oauthIntent?.role === role && Date.now() - oauthIntent.createdAt <= OAUTH_INTENT_MAX_AGE_MS) ||
      hasOAuthCallbackParams;

    shouldHandleOAuthSessionRef.current = shouldHandleOAuthSession;
 
    (async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();
 
      if (active && shouldHandleOAuthSession && session?.user) {
        await syncUserRoleAndRedirect(session.user.id);
      }
    })();
 
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (!session?.user) return;

      const authEvent = event as AuthEvent;
      const isOAuthSessionEvent =
        authEvent === "SIGNED_IN" || (authEvent === "INITIAL_SESSION" && shouldHandleOAuthSessionRef.current);

      if (isOAuthSessionEvent && shouldHandleOAuthSessionRef.current) {
        await syncUserRoleAndRedirect(session.user.id);
      }
    });
 
    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, [role, supabase, syncUserRoleAndRedirect]);
 
  async function handleSocialSignIn(provider: SocialProvider) {
    setMessage(null);
    setSocialLoading(provider);
 
    try {
      localStorage.setItem(ROLE_STORAGE_KEY, role);
      writeOAuthIntent(role);

      const { error: signOutError } = await supabase.auth.signOut({ scope: "local" });
      if (signOutError) {
        console.warn(
          "Unable to clear previous session before social sign in:",
          signOutError.message
        );
      }
 
      const redirectTo = `${window.location.origin}/auth/${role}`;
      const { error } = await supabase.auth.signInWithOAuth({
        provider: provider === "google" ? "google" : "azure",
        options: {
          redirectTo,
          queryParams: { prompt: "select_account" },
        },
      });
 
      if (error) {
        clearOAuthIntent();
        setMessage(error.message);
      }
    } catch (error: unknown) {
      clearOAuthIntent();
      setMessage(error instanceof Error ? error.message : "Unable to sign in right now.");
    } finally {
      setSocialLoading(null);
    }
  }
 
  async function handleEmailAuth(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage(null);
 
    const cleanName = fullName.trim();
    const cleanEmail = email.trim().toLowerCase();
 
    if (!cleanEmail || !password || (mode === "signup" && !cleanName)) {
      setMessage("Please complete all required fields.");
      return;
    }
 
    if (password.length < 6) {
      setMessage("Password must be at least 6 characters.");
      return;
    }
 
    setEmailLoading(true);
 
    try {
      localStorage.setItem(ROLE_STORAGE_KEY, role);
      clearOAuthIntent();

      const {
        data: { session: activeSession },
      } = await supabase.auth.getSession();

      if (
        activeSession?.user?.email &&
        activeSession.user.email.toLowerCase() !== cleanEmail
      ) {
        const { error: signOutError } = await supabase.auth.signOut({ scope: "local" });
        if (signOutError) {
          console.warn("Unable to clear previous session before sign in:", signOutError.message);
        }
      }
 
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
          setMessage(error.message);
          return;
        }
 
        if (data.session && data.user) {
          await syncRoleForUser(data.user, cleanName, role);
          redirectAfterLogin(role);
          return;
        }
 
        setMode("login");
        setPassword("");
        setMessage("Account created. Confirm your email if required, then sign in.");
        return;
      }
 
      const { data, error } = await supabase.auth.signInWithPassword({
        email: cleanEmail,
        password,
      });
 
      if (error) {
        const text = String(error.message || "Unable to sign in right now.");
        if (text.toLowerCase().includes("email not confirmed")) {
          setMessage(
            "Email not confirmed. Please check your inbox or disable email confirmation in Supabase Auth settings."
          );
        } else {
          setMessage(text);
        }
        return;
      }
 
      if (data.user) {
        await syncRoleForUser(data.user, "", role);
      }
 
      redirectAfterLogin(role);
    } catch (error: unknown) {
      setMessage(error instanceof Error ? error.message : "Unable to sign in right now.");
    } finally {
      setEmailLoading(false);
    }
  }
 
  const isBusy = emailLoading || Boolean(socialLoading) || syncingRole;
 
  return (
    <main className="flex min-h-screen items-center justify-center bg-[#FAF9F6] p-4 sm:p-6">
      <AuthCard>
        <AuthHeader role={role} />
 
        <div className="mt-6 inline-flex rounded-xl border border-violet-100 bg-violet-50/60 p-1">
          <button
            type="button"
            onClick={() => setMode("login")}
            className={`rounded-lg px-3 py-1.5 text-sm font-semibold transition ${
              mode === "login" ? "bg-violet-700 text-white" : "text-slate-700 hover:bg-white"
            }`}
          >
            Log in
          </button>
          <button
            type="button"
            onClick={() => setMode("signup")}
            className={`rounded-lg px-3 py-1.5 text-sm font-semibold transition ${
              mode === "signup" ? "bg-violet-700 text-white" : "text-slate-700 hover:bg-white"
            }`}
          >
            Sign up
          </button>
        </div>
 
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
 
        <form onSubmit={handleEmailAuth} className="space-y-4">
          {mode === "signup" ? (
            <AuthInput
              label="Full name"
              type="text"
              placeholder="Your full name"
              autoComplete="name"
              value={fullName}
              onChange={(event) => setFullName(event.target.value)}
              disabled={isBusy}
              required
            />
          ) : null}
 
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
            placeholder={mode === "signup" ? "Minimum 6 characters" : "Enter your password"}
            autoComplete={mode === "signup" ? "new-password" : "current-password"}
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
              ? mode === "signup"
                ? "Creating account..."
                : "Signing in..."
              : syncingRole
                ? "Finishing setup..."
                : mode === "signup"
                  ? `Create ${roleConfig.label} account`
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
            {mode === "login" ? "Need an account?" : "Already have an account?"}{" "}
            <button
              type="button"
              onClick={() => setMode((current) => (current === "login" ? "signup" : "login"))}
              className="font-medium text-indigo-700 hover:text-indigo-600"
            >
              {mode === "login" ? "Sign up" : "Log in"}
            </button>
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