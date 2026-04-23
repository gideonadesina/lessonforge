"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import LessonForgeOnboardingCard from "@/components/onboarding/LessonForgeOnboardingCard";
import LessonForgeWelcomeCard from "@/components/onboarding/LessonForgeWelcomeCard";
import { createBrowserSupabase } from "@/lib/supabase/browser";

type OnboardingProfile = {
  id: string;
  full_name: string | null;
  app_role: "teacher" | "principal" | null;
  onboarding_completed: boolean;
  welcome_seen: boolean;
  onboarding_answers: Record<string, unknown> | null;
};

type ViewState = "loading" | "onboarding" | "welcome";

function getRoleHomePath(role: OnboardingProfile["app_role"]) {
  return role === "principal" ? "/principal" : "/dashboard";
}

export default function OnboardingPage() {
  const router = useRouter();
  const supabase = useMemo(() => createBrowserSupabase(), []);

  const [viewState, setViewState] = useState<ViewState>("loading");
  const [profile, setProfile] = useState<OnboardingProfile | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let active = true;

    (async () => {
      setError(null);
      setViewState("loading");

      const {
        data: { session },
      } = await supabase.auth.getSession();
      const user = session?.user ?? null;

      if (!user) {
        router.replace("/login");
        return;
      }

      const { data: profileRow, error: profileError } = await supabase
        .from("profiles")
        .select(
          "id, full_name, app_role, onboarding_completed, welcome_seen, onboarding_answers"
        )
        .eq("id", user.id)
        .maybeSingle();

      if (!active) return;

      if (profileError || !profileRow) {
        setError(profileError?.message ?? "Could not load onboarding profile.");
        setViewState("loading");
        return;
      }

      const metadataRole =
        user.user_metadata?.app_role === "principal" ||
        user.user_metadata?.app_role === "teacher"
          ? user.user_metadata.app_role
          : null;

      const normalizedProfile: OnboardingProfile = {
        id: profileRow.id,
        full_name: profileRow.full_name ?? null,
        app_role:
          profileRow.app_role === "principal" || profileRow.app_role === "teacher"
            ? profileRow.app_role
            : metadataRole,
        onboarding_completed: Boolean(profileRow.onboarding_completed),
        welcome_seen: Boolean(profileRow.welcome_seen),
        onboarding_answers:
          profileRow.onboarding_answers &&
          typeof profileRow.onboarding_answers === "object"
            ? (profileRow.onboarding_answers as Record<string, unknown>)
            : null,
      };

      setProfile(normalizedProfile);

      if (normalizedProfile.onboarding_completed && normalizedProfile.welcome_seen) {
        router.replace(getRoleHomePath(normalizedProfile.app_role));
        return;
      }

      if (!normalizedProfile.onboarding_completed) {
        setViewState("onboarding");
        return;
      }

      setViewState("welcome");
    })().catch((err: unknown) => {
      if (!active) return;
      setError(err instanceof Error ? err.message : "Could not load onboarding.");
      setViewState("loading");
    });

    return () => {
      active = false;
    };
  }, [router, supabase]);

  async function handleOnboardingCompleted() {
    if (!profile?.id || busy) return;
    setBusy(true);
    setError(null);

    try {
      const { error: updateError } = await supabase
        .from("profiles")
        .update({
          onboarding_completed: true,
          updated_at: new Date().toISOString(),
        })
        .eq("id", profile.id);

      if (updateError) throw updateError;

      setProfile((prev) =>
        prev
          ? {
              ...prev,
              onboarding_completed: true,
            }
          : prev
      );
      setViewState("welcome");
    } catch (err: unknown) {
      setError(
        err instanceof Error ? err.message : "Could not complete onboarding."
      );
    } finally {
      setBusy(false);
    }
  }

  async function handleWelcomeDismissed() {
    if (!profile?.id || busy) return;
    setBusy(true);
    setError(null);

    try {
      const { error: updateError } = await supabase
        .from("profiles")
        .update({
          welcome_seen: true,
          updated_at: new Date().toISOString(),
        })
        .eq("id", profile.id);

      if (updateError) throw updateError;
      router.replace(getRoleHomePath(profile.app_role));
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Could not continue.");
      setBusy(false);
    }
  }

  const firstName =
    profile?.full_name?.trim().split(" ")[0] ||
    (profile?.app_role === "principal" ? "Principal" : "Teacher");

  const roleType = profile?.app_role === "principal" ? "principal" : "teacher";

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#FAF9F6] px-4 py-8">
      <div className="w-full max-w-5xl">
        {error ? (
          <div className="mb-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
            {error}
          </div>
        ) : null}

        {viewState === "onboarding" && profile ? (
          <LessonForgeOnboardingCard
            profileId={profile.id}
            initialAnswers={profile.onboarding_answers}
            initialRoleOverride={profile.app_role === "principal" ? "School Principal" : undefined}
            onCompleted={() => {
              void handleOnboardingCompleted();
            }}
          />
        ) : null}

        {viewState === "welcome" && profile ? (
          <LessonForgeWelcomeCard
            firstName={firstName}
            roleType={roleType}
            onStart={() => {
              void handleWelcomeDismissed();
            }}
          />
        ) : null}

        {viewState === "loading" && !error ? (
          <div className="rounded-xl border border-[var(--border)] bg-white px-5 py-4 text-sm text-[var(--text-secondary)]">
            Preparing your onboarding experience...
          </div>
        ) : null}
      </div>
    </main>
  );
}
