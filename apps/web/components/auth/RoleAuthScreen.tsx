"use client";

import type { User } from "@supabase/supabase-js";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from "react";

import AuthCard from "@/components/auth/AuthCard";
import AuthHeader from "@/components/auth/AuthHeader";
import AuthInput from "@/components/auth/AuthInput";
import SocialLoginButton from "@/components/auth/SocialLoginButton";
import type { AppRole } from "@/lib/auth/roles";
import {
  ROLE_CONTENT,
  clearPersistedActiveRole,
  getRoleHomePath,
  persistActiveRole,
} from "@/lib/auth/roles";
import {
  fetchRoleContext,
  getAuthErrorMessage,
  switchRole as switchRoleApi,
  type RoleContextResponse,
} from "@/lib/auth/client";
import { createBrowserSupabase } from "@/lib/supabase/browser";

type SocialProvider = "google" | "microsoft";
type Mode = "login" | "signup";

type RoleAuthScreenProps = {
  role: AppRole;
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

function hasOAuthCallbackParams() {
  if (typeof window === "undefined") return false;
  const searchParams = new URLSearchParams(window.location.search);
  return (
    searchParams.has("code") ||
    searchParams.has("access_token") ||
    searchParams.has("refresh_token") ||
    searchParams.has("provider_token")
  );
}

function normalizeAuthErrorMessage(error: unknown, fallback: string) {
  return getAuthErrorMessage(error, fallback);
}

function getNoAccountMessage() {
  return "We couldn't find an account for this email yet. Please sign up first, then continue.";
}

function getUnavailableRoleMessage(requestedRoleLabel: string) {
  return `You signed in successfully, but your account does not have ${requestedRoleLabel.toLowerCase()} access yet. Choose an available workspace to continue.`;
}

const SOCIAL_INTENT_STORAGE_KEY = "lessonforge:oauth-intent";
const REFERRAL_STORAGE_KEY = "lessonforge:referral-code";

function readSocialIntent(): Mode {
  if (typeof window === "undefined") return "login";
  const value = window.localStorage.getItem(SOCIAL_INTENT_STORAGE_KEY);
  return value === "signup" ? "signup" : "login";
}

function writeSocialIntent(mode: Mode) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(SOCIAL_INTENT_STORAGE_KEY, mode);
}

function clearSocialIntent() {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(SOCIAL_INTENT_STORAGE_KEY);
}

function readStoredReferralCode() {
  if (typeof window === "undefined") return null;
  const value = window.localStorage.getItem(REFERRAL_STORAGE_KEY);
  return value?.trim() || null;
}

function writeStoredReferralCode(code: string) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(REFERRAL_STORAGE_KEY, code.trim());
}

function clearStoredReferralCode() {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(REFERRAL_STORAGE_KEY);
}

export default function RoleAuthScreen({ role }: RoleAuthScreenProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const supabase = useMemo(() => createBrowserSupabase(), []);

  const [mode, setMode] = useState<Mode>("login");
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  const [message, setMessage] = useState<string | null>(null);
  const [emailLoading, setEmailLoading] = useState(false);
  const [socialLoading, setSocialLoading] = useState<SocialProvider | null>(null);
  const [syncingRole, setSyncingRole] = useState(false);

  const hasHandledSessionRef = useRef(false);

  const roleConfig = ROLE_CONTENT[role];

  const ensureProfile = useCallback(
    async (user: User, preferredName: string, preferredRole: AppRole) => {
      const metadata = (user.user_metadata ?? {}) as Record<string, unknown>;
      const profileBase = {
        id: user.id,
        email: user.email ?? "",
        full_name:
          preferredName.trim() ||
          (typeof metadata.full_name === "string" ? metadata.full_name : ""),
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

  const applyStoredReferralToProfile = useCallback(
    async (user: User) => {
      const storedRef = readStoredReferralCode();
      if (!storedRef) return;

      const { data: prof, error } = await supabase
        .from("profiles")
        .select("id, referral_code, referred_by")
        .eq("id", user.id)
        .single();

      if (error) {
        console.warn("Unable to read profile for referral sync:", error.message);
        return;
      }

      if (
        prof?.referral_code &&
        prof.referral_code.trim().toUpperCase() === storedRef.toUpperCase()
      ) {
        clearStoredReferralCode();
        return;
      }

      if (!prof?.referred_by) {
        const { error: updateError } = await supabase
          .from("profiles")
          .update({
            referred_by: storedRef.toUpperCase(),
            updated_at: new Date().toISOString(),
          })
          .eq("id", user.id);

        if (updateError) {
          console.warn("Unable to save referral code:", updateError.message);
          return;
        }
      }

      clearStoredReferralCode();
    },
    [supabase]
  );

  const ensureSignupProfile = useCallback(
    async (user: User, preferredName: string) => {
      const nextMetadata: Record<string, unknown> = {
        ...(user.user_metadata ?? {}),
        app_role: role,
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

      await ensureProfile(user, preferredName, role);
      await applyStoredReferralToProfile(user);
    },
    [applyStoredReferralToProfile, ensureProfile, role, supabase]
  );

const resolveRoleAfterAuth = useCallback(
  async (
    requestedRole: AppRole,
    options: { allowUnprovisioned?: boolean } = {}
  ): Promise<RoleContextResponse> => {
    const roleContext = await fetchRoleContext();

    if (!roleContext.availableRoles.length) {
      return roleContext;
    }

    if (!roleContext.availableRoles.includes(requestedRole)) {
      setMessage(getUnavailableRoleMessage(ROLE_CONTENT[requestedRole].label));
    }

    return roleContext;
  },
  []
);

  const syncUserRoleAndRedirect = useCallback(
    async (userId?: string) => {
      if (hasHandledSessionRef.current) return;
      hasHandledSessionRef.current = true;
      setSyncingRole(true);
      setMessage(null);

      try {
        const {
          data: { user },
          error: userError,
        } = await supabase.auth.getUser();

        if (userError) throw userError;
        if (!user || (userId && user.id !== userId)) {
          hasHandledSessionRef.current = false;
          return;
        }

        const roleContext = await resolveRoleAfterAuth(role, {
          allowUnprovisioned: true,
        });

        if (!roleContext.availableRoles.length) {
          const { homePath } = await switchRoleApi(role, {
            claimIfUnprovisioned: true,
          });
          persistActiveRole(role);
          clearSocialIntent();
          router.replace(homePath);
          router.refresh();
          return;
        }

        if (roleContext.availableRoles.includes(role)) {
          const { homePath } = await switchRoleApi(role);
          persistActiveRole(role);
          clearSocialIntent();
          router.replace(homePath);
          router.refresh();
          return;
        }

        return;
      } catch (error: unknown) {
        hasHandledSessionRef.current = false;
        setMessage(normalizeAuthErrorMessage(error, "Unable to finish sign in."));
      } finally {
        setSyncingRole(false);
      }
    },
    [applyStoredReferralToProfile, ensureSignupProfile, role, resolveRoleAfterAuth, supabase]
  );

  useEffect(() => {
    const ref = searchParams.get("ref");
    if (ref && ref.trim()) {
      writeStoredReferralCode(ref.trim().toUpperCase());
    }
  }, [searchParams]);

  useEffect(() => {
    let active = true;

    persistActiveRole(role);
    if (!hasOAuthCallbackParams()) return;

    (async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (active && session?.user) {
        await syncUserRoleAndRedirect(session.user.id);
      }
    })();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (!session?.user) return;

      if (event === "SIGNED_IN" || event === "INITIAL_SESSION") {
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
    persistActiveRole(role);
    writeSocialIntent(mode);

    const redirectTo = `${window.location.origin}/auth/${role}`;

    const { error } = await supabase.auth.signInWithOAuth({
      provider: provider === "google" ? "google" : "azure",
      options: {
        redirectTo,
      },
    });

    if (error) {
      setMessage(error.message);
      clearSocialIntent();
    }
  } catch (error: unknown) {
    setMessage(error instanceof Error ? error.message : "Unable to sign in right now.");
    clearSocialIntent();
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
      persistActiveRole(role);

      const {
        data: { session: activeSession },
      } = await supabase.auth.getSession();

      if (
        activeSession?.user?.email &&
        activeSession.user.email.toLowerCase() !== cleanEmail
      ) {
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
          await ensureSignupProfile(data.user, cleanName);
          const roleContext = await resolveRoleAfterAuth(role);

          if (!roleContext.availableRoles.length) {
            const { homePath } = await switchRoleApi(role, {
              claimIfUnprovisioned: true,
            });
            persistActiveRole(role);
            clearSocialIntent();
           window.location.href = homePath;
return;
          }

          const nextRole =
            (roleContext.availableRoles.includes(role) ? role : roleContext.activeRole) ??
            roleContext.availableRoles[0];
          if (!nextRole) {
            throw new Error("No workspace role is available for this account.");
          }

          const { homePath } = await switchRoleApi(nextRole);
          persistActiveRole(nextRole);
          clearSocialIntent();
          router.replace(homePath);
          router.refresh();
          return;
        }

        setMode("login");
        setPassword("");
        setMessage(
          "Account created. Check your email to confirm your account, then return to sign in."
        );
        clearSocialIntent();
        return;
      }

      const { data, error } = await supabase.auth.signInWithPassword({
        email: cleanEmail,
        password,
      });

      if (error) {
        const text = String(error.message || "Unable to sign in right now.");
        const normalizedText = text.toLowerCase();
        if (text.toLowerCase().includes("email not confirmed")) {
          setMessage(
            "Email not confirmed. Please check your inbox or disable email confirmation in Supabase Auth settings."
          );
        } else if (
          normalizedText.includes("invalid login credentials") ||
          normalizedText.includes("user not found") ||
          normalizedText.includes("invalid credentials")
        ) {
          setMessage(getNoAccountMessage());
        } else {
          setMessage(text);
        }
        return;
      }

      if (!data.user) {
        throw new Error("Unable to load your account after sign in.");
      }

      clearSocialIntent();
      const roleContext = await resolveRoleAfterAuth(role);

      if (!roleContext.availableRoles.length) {
        const { homePath } = await switchRoleApi(role, {
          claimIfUnprovisioned: true,
        });
        persistActiveRole(role);
        router.replace(homePath);
        router.refresh();
        return;
      }

      const nextRole =
        (roleContext.availableRoles.includes(role) ? role : roleContext.activeRole) ??
        roleContext.availableRoles[0];
      if (!nextRole) {
        throw new Error("No workspace role is available for this account.");
      }

      const { homePath } = await switchRoleApi(nextRole);
      persistActiveRole(nextRole);
      router.replace(homePath);
      router.refresh();
    } catch (error: unknown) {
      setMessage(normalizeAuthErrorMessage(error, "Unable to sign in right now."));
      clearSocialIntent();
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
            onClick={() => {
              setMode("login");
              clearSocialIntent();
            }}
            className={`rounded-lg px-3 py-1.5 text-sm font-semibold transition ${
              mode === "login" ? "bg-violet-700 text-white" : "text-slate-700 hover:bg-white"
            }`}
          >
            Log in
          </button>
          <button
            type="button"
            onClick={() => {
              setMode("signup");
              clearSocialIntent();
            }}
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

          <div className="space-y-2">
            <label htmlFor="auth-password" className="block text-sm font-medium text-slate-700">
              Password
            </label>
            <div className="relative">
              <input
                id="auth-password"
                type={showPassword ? "text" : "password"}
                placeholder={mode === "signup" ? "Minimum 6 characters" : "Enter your password"}
                autoComplete={mode === "signup" ? "new-password" : "current-password"}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                disabled={isBusy}
                required
                className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 pr-16 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-violet-400 focus:ring-4 focus:ring-violet-100 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-500"
              />
              <button
                type="button"
                onClick={() => setShowPassword((current) => !current)}
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-600 hover:bg-slate-50"
                aria-label={showPassword ? "Hide password" : "Show password"}
                disabled={isBusy}
              >
                {showPassword ? "Hide" : "Show"}
              </button>
            </div>

            {mode === "login" ? (
              <div className="flex justify-end">
                <Link
                  href="/forgot-password"
                  className="text-sm font-medium text-indigo-700 hover:text-indigo-600"
                >
                  Forgot password?
                </Link>
              </div>
            ) : null}
          </div>

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
              onClick={() =>
                setMode((current) => {
                  const nextMode = current === "login" ? "signup" : "login";
                  clearSocialIntent();
                  return nextMode;
                })
              }
              className="font-medium text-indigo-700 hover:text-indigo-600"
            >
              {mode === "login" ? "Sign up" : "Log in"}
            </button>
          </p>
          {mode === "login" ? (
            <p className="text-xs text-slate-500">
              New to LessonForge? Create an account first, then come back to log in.
            </p>
          ) : null}
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