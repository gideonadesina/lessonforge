"use client";

import type { User } from "@supabase/supabase-js";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";

import AuthCard from "@/components/auth/AuthCard";
import AuthHeader from "@/components/auth/AuthHeader";
import AuthInput from "@/components/auth/AuthInput";
import { AuthLoadingOverlay } from "@/components/auth/AuthLoadingOverlay";
import AuthNotificationBanner from "@/components/auth/AuthNotificationBanner";
import SocialLoginButton from "@/components/auth/SocialLoginButton";
import type { AppRole } from "@/lib/auth/roles";
import {
  ROLE_CONTENT,
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
type AuthBanner = "none" | "no-account";

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

function normalizeAuthErrorMessage(error: unknown, fallback: string) {
  return getAuthErrorMessage(error, fallback);
}

function getNoAccountWarmMessage() {
  return "You haven't joined LessonForge yet — and great teachers deserve great tools. Let's get you started.";
}

function getUnavailableRoleMessage(requestedRoleLabel: string) {
  return `You signed in successfully, but your account does not have ${requestedRoleLabel.toLowerCase()} access yet. Choose an available workspace to continue.`;
}

const SOCIAL_INTENT_STORAGE_KEY = "lessonforge:oauth-intent";
const REFERRAL_STORAGE_KEY = "lessonforge:referral-code";
const OAUTH_LOADING_STORAGE_KEY = "lessonforge:oauth-loading-provider";

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

function readOAuthLoadingProvider(): SocialProvider | null {
  if (typeof window === "undefined") return null;
  const provider = window.localStorage.getItem(OAUTH_LOADING_STORAGE_KEY);
  return provider === "google" || provider === "microsoft" ? provider : null;
}

function writeOAuthLoadingProvider(provider: SocialProvider) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(OAUTH_LOADING_STORAGE_KEY, provider);
}

function clearOAuthLoadingProvider() {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(OAUTH_LOADING_STORAGE_KEY);
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
  const [authBanner, setAuthBanner] = useState<AuthBanner>("none");
  const [emailLoading, setEmailLoading] = useState(false);
  const [socialLoading, setSocialLoading] = useState<SocialProvider | null>(null);
  const [oauthOverlayProvider, setOauthOverlayProvider] = useState<SocialProvider | null>(null);
  const [oauthInlineError, setOauthInlineError] = useState(false);
  const [lastOAuthProvider, setLastOAuthProvider] = useState<SocialProvider>("google");

  const roleConfig = ROLE_CONTENT[role];

  useEffect(() => {
    if (typeof window === "undefined") return;
    const current = new URL(window.location.href);
    const hasCleanupParam =
      current.searchParams.has("oauth_no_account") ||
      current.searchParams.has("oauth_error") ||
      current.searchParams.has("oauth_intent");
    if (!hasCleanupParam) return;

    current.searchParams.delete("oauth_no_account");
    current.searchParams.delete("oauth_error");
    current.searchParams.delete("oauth_intent");
    window.history.replaceState({}, "", current.toString());
  }, [searchParams]);

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
  async (requestedRole: AppRole): Promise<RoleContextResponse> => {
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

  useEffect(() => {
    const ref = searchParams.get("ref");
    if (ref && ref.trim()) {
      writeStoredReferralCode(ref.trim().toUpperCase());
    }
  }, [searchParams]);

  useEffect(() => {
    const provider = readOAuthLoadingProvider();
    const returnedWithNoSession = searchParams.get("oauth_no_account") === "1";
    const oauthError = searchParams.get("oauth_error") === "1";
    const oauthIntent = searchParams.get("oauth_intent");
    if (oauthIntent === "signup") {
      setMode("signup");
    } else if (oauthIntent === "login") {
      setMode("login");
    }
    if (returnedWithNoSession) {
      setAuthBanner("no-account");
      setOauthInlineError(false);
      clearOAuthLoadingProvider();
      setOauthOverlayProvider(null);
      setSocialLoading(null);
      return;
    }
    if (oauthError) {
      setOauthOverlayProvider(null);
      setSocialLoading(null);
      setOauthInlineError(true);
      clearOAuthLoadingProvider();
      return;
    }

   if (provider) {
      setOauthOverlayProvider(provider);
      setLastOAuthProvider(provider);
      // Auto-clear after 30s so a failed OAuth never freezes the page permanently
      setTimeout(() => {
        clearOAuthLoadingProvider();
        setOauthOverlayProvider(null);
      }, 30000);
    }
  }, [searchParams]);

  async function handleSocialSignIn(provider: SocialProvider) {
    setMessage(null);
    setAuthBanner("none");
    setOauthInlineError(false);
    setSocialLoading(provider);
    setOauthOverlayProvider(provider);
    setLastOAuthProvider(provider);
    writeOAuthLoadingProvider(provider);

    try {
      // Store the requested role for the callback route
      persistActiveRole(role);
      writeSocialIntent(mode);

      // Redirect OAuth to the dedicated callback route
      // The callback route will handle everything: session, profile, role, redirect
      const redirectTo = `${window.location.origin}/auth/callback`;

      const { error } = await supabase.auth.signInWithOAuth({
        provider: provider === "google" ? "google" : "azure",
        options: {
          redirectTo,
        },
      });

      if (error) {
        setMessage(error.message);
        setOauthOverlayProvider(null);
        setOauthInlineError(true);
        clearOAuthLoadingProvider();
        clearSocialIntent();
      }
    } catch (error: unknown) {
      setMessage(error instanceof Error ? error.message : "Unable to sign in right now.");
      setOauthOverlayProvider(null);
      setOauthInlineError(true);
      clearOAuthLoadingProvider();
      clearSocialIntent();
    } finally {
      setSocialLoading(null);
    }
  }

  async function handleEmailAuth(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage(null);
    setAuthBanner("none");
    setOauthInlineError(false);

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

          if (!roleContext.availableRoles.length || (role === "principal" && !roleContext.availableRoles.includes(role))) {
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
          setAuthBanner("no-account");
          setMessage(null);
        } else {
          setMessage(text);
        }
        return;
      }

      if (!data.user) {
        throw new Error("Unable to load your account after sign in.");
      }

      setOauthInlineError(false);
      clearSocialIntent();
      const roleContext = await resolveRoleAfterAuth(role);

      if (!roleContext.availableRoles.length || (role === "principal" && !roleContext.availableRoles.includes(role))) {
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
      setOauthOverlayProvider(null);
      clearOAuthLoadingProvider();
      clearSocialIntent();
    } finally {
      setEmailLoading(false);
    }
  }

  const isBusy = emailLoading || Boolean(socialLoading);

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#FAF9F6] p-4 sm:p-6">
      {oauthOverlayProvider ? <AuthLoadingOverlay provider={oauthOverlayProvider} /> : null}

      <div className="w-full max-w-md space-y-4">
        {authBanner === "no-account" ? (
          <AuthNotificationBanner
            type="info"
            icon="👋"
            message={getNoAccountWarmMessage()}
            actions={[
              {
                label: "Create My Account →",
                onClick: () => {
                  setMode("signup");
                  setAuthBanner("none");
                },
                variant: "primary",
              },
              {
                label: "Try a different email",
                onClick: () => {
                  setEmail("");
                  setPassword("");
                  setAuthBanner("none");
                },
                variant: "ghost",
              },
            ]}
          />
        ) : null}

        <AuthCard>
          <AuthHeader role={role} />

          <div className="mt-6 inline-flex rounded-[12px] border border-[#E2E8F0] bg-[#EEEDFE]/70 p-1">
          <button
            type="button"
            onClick={() => {
              setMode("login");
              clearSocialIntent();
            }}
            className={`rounded-[10px] px-3 py-1.5 text-sm font-bold transition-all duration-200 ${
              mode === "login" ? "bg-[#534AB7] text-white" : "text-[#475569] hover:bg-white"
            }`}
            style={{ fontFamily: '"Trebuchet MS", sans-serif' }}
          >
            Log in
          </button>
          <button
            type="button"
            onClick={() => {
              setMode("signup");
              clearSocialIntent();
            }}
            className={`rounded-[10px] px-3 py-1.5 text-sm font-bold transition-all duration-200 ${
              mode === "signup" ? "bg-[#534AB7] text-white" : "text-[#475569] hover:bg-white"
            }`}
            style={{ fontFamily: '"Trebuchet MS", sans-serif' }}
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

          {oauthInlineError ? (
            <div className="mt-4 rounded-[14px] border border-[#F59E0B]/25 bg-[#FFFBEB] px-4 py-3">
              <p
                className="text-sm text-[#92400E]"
                style={{ fontFamily: '"Trebuchet MS", sans-serif' }}
              >
                Something went wrong connecting your account.
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => handleSocialSignIn(lastOAuthProvider)}
                  className="inline-flex items-center justify-center rounded-[12px] bg-gradient-to-br from-[#534AB7] to-[#3D35A0] px-4 py-2 text-sm font-bold text-white shadow-[0_4px_16px_rgba(83,74,183,0.35)] transition-all duration-200 hover:-translate-y-[1px] hover:shadow-[0_6px_18px_rgba(83,74,183,0.4)]"
                  style={{ fontFamily: '"Trebuchet MS", sans-serif' }}
                >
                  Try Again
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setOauthInlineError(false);
                    setMessage(null);
                    setOauthOverlayProvider(null);
                    clearOAuthLoadingProvider();
                  }}
                  className="inline-flex items-center justify-center rounded-[12px] border-[1.5px] border-[#534AB7] px-4 py-2 text-sm font-bold text-[#534AB7] transition-all duration-200 hover:bg-[#EEEDFE]"
                  style={{ fontFamily: '"Trebuchet MS", sans-serif' }}
                >
                  Use email instead
                </button>
              </div>
            </div>
          ) : null}

          <div className="my-6 flex items-center gap-3">
            <div className="h-px flex-1 bg-[#E2E8F0]" />
            <span
              className="text-xs uppercase tracking-[2.5px] text-[#94A3B8]"
              style={{ fontFamily: '"Trebuchet MS", sans-serif' }}
            >
              or continue with email
            </span>
            <div className="h-px flex-1 bg-[#E2E8F0]" />
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
              <label
                htmlFor="auth-password"
                className="block text-sm font-medium text-[#475569]"
                style={{ fontFamily: '"Trebuchet MS", sans-serif' }}
              >
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
                  className="w-full rounded-[10px] border-[1.5px] border-[#E2E8F0] bg-white px-4 py-3 pr-16 text-sm text-[#1E1B4B] outline-none transition-all duration-200 placeholder:text-[#94A3B8] focus:border-[#534AB7] focus:ring-[3px] focus:ring-[rgba(83,74,183,0.15)] disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-500"
                  style={{ fontFamily: '"Trebuchet MS", sans-serif' }}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((current) => !current)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 rounded-[8px] border border-[#E2E8F0] bg-white px-2.5 py-1 text-xs font-bold text-[#475569] transition-all duration-200 hover:bg-[#EEEDFE]"
                  style={{ fontFamily: '"Trebuchet MS", sans-serif' }}
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
                    className="text-sm font-bold text-[#534AB7] transition-all duration-200 hover:text-[#3D35A0]"
                    style={{ fontFamily: '"Trebuchet MS", sans-serif' }}
                  >
                    Forgot password?
                  </Link>
                </div>
              ) : null}
            </div>

            <button
              type="submit"
              disabled={isBusy}
              className="w-full rounded-[12px] bg-gradient-to-br from-[#534AB7] to-[#3D35A0] px-4 py-[13px] text-sm font-bold text-white shadow-[0_4px_16px_rgba(83,74,183,0.35)] transition-all duration-200 hover:-translate-y-[1px] hover:shadow-[0_6px_18px_rgba(83,74,183,0.4)] disabled:cursor-not-allowed disabled:opacity-65"
              style={{ fontFamily: '"Trebuchet MS", sans-serif' }}
            >
              {emailLoading
                ? mode === "signup"
                  ? "Creating account..."
                  : "Signing in..."
                : mode === "signup"
                ? `Create ${roleConfig.label} account`
                : `Sign in as ${roleConfig.label}`}
            </button>
          </form>

          {message ? (
            <div
              className="mt-4 rounded-[14px] border px-4 py-3 text-sm"
              style={{
                background: "rgba(83,74,183,0.10)",
                borderColor: "rgba(83,74,183,0.25)",
                color: "#1E1B4B",
                fontFamily: '"Trebuchet MS", sans-serif',
              }}
            >
              {message}
            </div>
          ) : null}

          <div
            className="mt-6 space-y-2 text-center text-sm text-[#475569]"
            style={{ fontFamily: '"Trebuchet MS", sans-serif' }}
          >
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
                className="font-bold text-[#534AB7] transition-all duration-200 hover:text-[#3D35A0]"
              >
                {mode === "login" ? "Sign up" : "Log in"}
              </button>
            </p>
            {mode === "login" ? (
              <p className="text-xs text-[#94A3B8]">
                New to LessonForge? Create an account first, then come back to log in.
              </p>
            ) : null}
            <p>
              Not your role?{" "}
              <Link
                className="font-bold text-[#534AB7] transition-all duration-200 hover:text-[#3D35A0]"
                href="/select-role"
              >
                Change role
              </Link>
            </p>
          </div>
        </AuthCard>
      </div>
    </main>
  );
}
