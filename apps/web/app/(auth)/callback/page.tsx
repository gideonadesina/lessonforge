/**
 * OAuth Callback Handler
 *
 * Client-side callback page that:
 * 1. Shows a full-screen loading overlay
 * 2. Waits for the Supabase browser client to exchange the OAuth code
 * 3. Calls the /api/auth/callback endpoint to complete setup
 * 4. Redirects to the target dashboard
 *
 * This approach ensures Supabase handles OAuth properly and the server
 * can process the setup with a valid session.
 */

"use client";

import { useEffect, useState } from "react";
import { AuthLoadingOverlay } from "@/components/auth/AuthLoadingOverlay";

export default function OAuthCallbackPage() {
  const [error, setError] = useState<string | null>(null);
  const [showFallback, setShowFallback] = useState(false);

  useEffect(() => {
    const handleCallback = async () => {
      try {
        console.log("[OAuth Callback] Processing callback");

        // Give Supabase browser client a moment to handle the OAuth exchange
        // The code in URL triggers Supabase's built-in exchange
        await new Promise((resolve) => setTimeout(resolve, 500));

        // Call server-side setup endpoint
        const response = await fetch("/api/auth/callback", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({}),
        });

        const result = await response.json();

        if (!response.ok || !result.ok) {
          throw new Error(result.error || "Setup failed");
        }

        console.log("[OAuth Callback] Redirecting to", result.redirectUrl);
        window.location.href = result.redirectUrl;
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : "Unknown error";
        console.error("[OAuth Callback] Error:", message);
        setError(message);

        // Show fallback after 5 seconds
        setTimeout(() => setShowFallback(true), 5000);
      }
    };

    handleCallback();
  }, []);

  if (error) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-white/95 backdrop-blur-sm">
        <div className="flex flex-col items-center gap-6 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-red-50">
            <svg
              className="h-6 w-6 text-red-600"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </div>

          <div>
            <h1 className="text-xl font-semibold text-slate-900">Setup Failed</h1>
            <p className="mt-2 text-sm text-slate-600">{error}</p>
          </div>

          {showFallback && (
            <div className="mt-4 flex w-full max-w-xs flex-col gap-3">
              <a
                href="/auth/teacher"
                className="inline-flex items-center justify-center rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 px-4 py-2.5 text-sm font-semibold text-white shadow-md transition hover:from-indigo-500 hover:to-violet-500"
              >
                Try Again
              </a>
              <a
                href="/select-role"
                className="inline-flex items-center justify-center rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
              >
                Select Role
              </a>
            </div>
          )}
        </div>
      </div>
    );
  }

  return <AuthLoadingOverlay />;
}