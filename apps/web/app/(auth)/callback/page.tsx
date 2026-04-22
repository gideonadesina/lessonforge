"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AuthLoadingOverlay } from "@/components/auth/AuthLoadingOverlay";
import LessonForgeWordmark from "@/components/auth/LessonForgeWordmark";
import { createBrowserSupabase } from "@/lib/supabase/browser";
import { readStoredRole, type AppRole } from "@/lib/auth/roles";

export default function OAuthCallbackPage() {
  const router = useRouter();
  const supabase = useMemo(() => createBrowserSupabase(), []);
  const startedRef = useRef(false);
  const redirectedRef = useRef(false);

  const [provider, setProvider] = useState<"google" | "microsoft" | null>(null);
  const [progress, setProgress] = useState(10);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const storedProvider = window.localStorage.getItem("lessonforge:oauth-loading-provider");
    setProvider(storedProvider === "microsoft" ? "microsoft" : "google");
  }, []);

  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;

    const handleCallback = async () => {
      try {
        setProgress(18);

        // Wait for Supabase to complete OAuth code exchange.
        let sessionReady = false;
        for (let attempt = 0; attempt < 10; attempt += 1) {
          const { data } = await supabase.auth.getSession();
          if (data.session?.user) {
            sessionReady = true;
            break;
          }
          await new Promise((resolve) => setTimeout(resolve, 220));
          setProgress((current) => Math.min(current + 4, 45));
        }

        if (!sessionReady) {
          throw new Error("Session was not established after sign-in.");
        }

        setProgress(62);
        const intent =
          window.localStorage.getItem("lessonforge:oauth-intent") === "signup"
            ? "signup"
            : "login";
        const response = await fetch("/api/auth/callback", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ intent }),
        });

        const result = await response.json();

        if (!response.ok || !result.ok || typeof result.redirectUrl !== "string") {
          if (result?.code === "account_not_registered") {
            const role = (readStoredRole() ?? "teacher") as AppRole;
            window.localStorage.removeItem("lessonforge:oauth-loading-provider");
            router.replace(`/auth/${role}?oauth_no_account=1&oauth_intent=${intent}`);
            return;
          }
          throw new Error(result.error || "Setup failed");
        }

        if (redirectedRef.current) return;
        redirectedRef.current = true;
        setProgress(100);
        window.localStorage.removeItem("lessonforge:oauth-loading-provider");
        window.location.href = result.redirectUrl;
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : "Unknown error";
        setError(message);
        setProgress(0);
        window.localStorage.removeItem("lessonforge:oauth-loading-provider");
        const role = (readStoredRole() ?? "teacher") as AppRole;
        window.setTimeout(() => {
          router.replace(`/auth/${role}?oauth_error=1`);
        }, 800);
      }
    };

    void handleCallback();
  }, [router, supabase]);

  if (error) {
    const role = readStoredRole() ?? "teacher";
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#FAF9F6] p-4">
        <div className="w-full max-w-[420px] rounded-[20px] border border-[#E2E8F0] bg-white p-6 shadow-[0_4px_24px_rgba(83,74,183,0.08)]">
          <div className="mb-5 flex justify-center">
            <LessonForgeWordmark href={null} />
          </div>
          <div
            className="rounded-[14px] border px-[18px] py-[14px]"
            style={{
              background: "rgba(245,158,11,0.10)",
              borderColor: "rgba(245,158,11,0.25)",
            }}
          >
            <p style={{ fontFamily: '"Trebuchet MS", sans-serif', color: "#92400E" }}>
              Something went wrong connecting your account.
            </p>
            <p
              className="mt-1 text-xs text-[#475569]"
              style={{ fontFamily: '"Trebuchet MS", sans-serif' }}
            >
              {error}
            </p>
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => router.replace(`/auth/${role}`)}
              className="inline-flex items-center justify-center rounded-[12px] bg-gradient-to-br from-[#534AB7] to-[#3D35A0] px-4 py-2 text-sm font-bold text-white shadow-[0_4px_16px_rgba(83,74,183,0.35)] transition-all duration-200 hover:-translate-y-[1px] hover:shadow-[0_6px_18px_rgba(83,74,183,0.4)]"
              style={{ fontFamily: '"Trebuchet MS", sans-serif' }}
            >
              Try Again
            </button>
            <button
              type="button"
              onClick={() => router.replace(`/auth/${role}`)}
              className="inline-flex items-center justify-center rounded-[12px] border-[1.5px] border-[#534AB7] px-4 py-2 text-sm font-bold text-[#534AB7] transition-all duration-200 hover:bg-[#EEEDFE]"
              style={{ fontFamily: '"Trebuchet MS", sans-serif' }}
            >
              Use email instead
            </button>
          </div>
        </div>
      </main>
    );
  }

  return <AuthLoadingOverlay provider={provider} progress={progress} />;
}