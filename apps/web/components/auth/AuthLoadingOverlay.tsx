/**
 * Full-screen loading overlay shown during OAuth callback processing.
 * Clean, deterministic, teacher-premium-first aesthetic.
 */

"use client";

import { useEffect, useState } from "react";

interface AuthLoadingOverlayProps {
  /** Title text to display */
  title?: string;
  /** Subtitle/message text */
  subtitle?: string;
  /** Show fallback message after timeout */
  showFallback?: boolean;
  /** Callback when fallback is shown (timeout occurred) */
  onTimeout?: () => void;
}

export function AuthLoadingOverlay({
  title = "Finishing setup...",
  subtitle = "Setting up your workspace",
  showFallback = false,
  onTimeout,
}: AuthLoadingOverlayProps) {
  const [showMessage, setShowMessage] = useState(false);

  useEffect(() => {
    if (!showFallback) return;

    const timer = setTimeout(() => {
      setShowMessage(true);
      onTimeout?.();
    }, 300);

    return () => clearTimeout(timer);
  }, [showFallback, onTimeout]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-white/95 backdrop-blur-sm">
      <div className="flex flex-col items-center gap-6 text-center">
        {/* Animated spinner */}
        <div className="relative h-12 w-12">
          <div className="absolute inset-0 rounded-full border-4 border-slate-200" />
          <div className="absolute inset-0 rounded-full border-4 border-transparent border-t-gradient-to-r border-t-from-indigo-600 border-t-to-violet-600 animate-spin" />
        </div>

        {/* Main text */}
        <div>
          <h1 className="text-xl font-semibold text-slate-900">{title}</h1>
          <p className="mt-2 text-sm text-slate-600">{subtitle}</p>
        </div>

        {/* Fallback message (shown after timeout) */}
        {showMessage && (
          <div className="mt-4 max-w-sm rounded-lg border border-amber-200 bg-amber-50 p-4 animate-fade-in">
            <p className="text-sm font-medium text-amber-900">
              Setup is taking longer than expected.
            </p>
            <p className="mt-2 text-xs text-amber-700">
              This might mean our servers are busy. Would you like to continue to your dashboard or try again?
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * Alternative: A more minimal loading state if needed.
 */
export function MinimalAuthLoading() {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-white">
      {/* Minimal pulse animation */}
      <div className="h-3 w-3 rounded-full bg-indigo-600 animate-pulse" />
    </div>
  );
}
