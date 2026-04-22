"use client";

import { useEffect, useMemo, useState } from "react";
import LessonForgeWordmark from "@/components/auth/LessonForgeWordmark";

interface AuthLoadingOverlayProps {
  provider?: "google" | "microsoft" | null;
  progress?: number;
  title?: string;
  subtitle?: string;
}

export function AuthLoadingOverlay({
  provider = null,
  progress,
  title,
  subtitle,
}: AuthLoadingOverlayProps) {
  const [internalProgress, setInternalProgress] = useState(8);

  useEffect(() => {
    if (typeof progress === "number") {
      setInternalProgress(Math.max(0, Math.min(progress, 100)));
      return;
    }

    const timer = window.setInterval(() => {
      setInternalProgress((current) => {
        if (current >= 96) return current;
        if (current < 30) return Math.min(current + 6, 30);
        if (current < 70) return Math.min(current + 4, 70);
        return Math.min(current + 2, 96);
      });
    }, 420);

    return () => window.clearInterval(timer);
  }, [progress]);

  const displayProgress =
    typeof progress === "number"
      ? Math.max(0, Math.min(progress, 100))
      : internalProgress;

  const status = useMemo(() => {
    if (title) return title;
    if (displayProgress >= 100) return "You're in! ✓";
    if (displayProgress >= 70) return "Almost ready for you...";
    if (displayProgress >= 30) return "Setting up your workspace...";
    return "Verifying your account...";
  }, [displayProgress, title]);

  const statusColor = displayProgress >= 100 ? "#059669" : "#475569";

  const providerCopy =
    subtitle ??
    (provider === "microsoft"
      ? "Secured by Microsoft"
      : provider === "google"
      ? "Secured by Google"
      : "Secured by LessonForge");

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center bg-[rgba(250,249,246,0.96)] p-4 backdrop-blur-[12px]">
      <div className="w-full max-w-[400px] rounded-[20px] border border-[#E2E8F0] bg-white px-6 py-7 shadow-[0_4px_24px_rgba(83,74,183,0.08)]">
        <div className="flex justify-center">
          <LessonForgeWordmark href={null} />
        </div>

        <div className="mt-6 h-[6px] w-full overflow-hidden rounded-full bg-[#EEEDFE]">
          <div
            className="h-full rounded-full bg-gradient-to-r from-[#534AB7] to-[#7C75D4] transition-[width] duration-500 ease-in-out"
            style={{ width: `${displayProgress}%` }}
          />
        </div>

        <p
          className="mt-4 text-center text-sm font-normal"
          style={{ fontFamily: '"Trebuchet MS", sans-serif', color: statusColor }}
        >
          {status}
        </p>
        <p
          className="mt-2 text-center text-xs text-[#94A3B8]"
          style={{ fontFamily: '"Trebuchet MS", sans-serif' }}
        >
          {providerCopy}
        </p>
      </div>
    </div>
  );
}

export function MinimalAuthLoading() {
  return <AuthLoadingOverlay />;
}
