/**
 * Auth Error Page
 * Displays authentication errors with helpful messaging and recovery options.
 */

import Link from "next/link";
import LessonForgeWordmark from "@/components/auth/LessonForgeWordmark";

interface AuthErrorPageProps {
  searchParams: Promise<{
    code?: string;
    message?: string;
    stage?: string;
  }>;
}

export default async function AuthErrorPage({ searchParams }: AuthErrorPageProps) {
  const params = await searchParams;
  const code = params.code || "unknown_error";
  const message = params.message ? decodeURIComponent(params.message) : "Authentication failed";
  const stage = params.stage || "unknown";

  const getErrorTitle = (errorCode: string) => {
    switch (errorCode) {
      case "no_code":
        return "Missing Authorization Code";
      case "setup_failed":
        return "Setup Failed";
      case "timeout":
        return "Setup Timeout";
      default:
        return "Authentication Error";
    }
  };

  const getErrorDescription = (errorCode: string) => {
    switch (errorCode) {
      case "no_code":
        return "The authentication server didn't provide an authorization code. This usually means the OAuth request was cancelled or timed out.";
      case "setup_failed":
        return "We encountered an error while setting up your workspace. Please try signing in again. If the problem persists, contact support.";
      case "timeout":
        return "Setup is taking longer than expected. Please try again or contact support if the issue continues.";
      default:
        return message;
    }
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#FAF9F6] p-4 sm:p-6">
      <div className="w-full max-w-md space-y-4">
        <div className="rounded-[14px] border border-[rgba(245,158,11,0.25)] bg-[rgba(245,158,11,0.10)] px-[18px] py-[14px] animate-fade-slide-down">
          <p style={{ fontFamily: '"Trebuchet MS", sans-serif', color: "#92400E" }}>
            We hit a temporary sign-in issue — let us get you back in.
          </p>
        </div>

      <div className="w-full rounded-[20px] border border-[#E2E8F0] bg-white p-8 shadow-[0_4px_24px_rgba(83,74,183,0.08)]">
        <div className="flex justify-center">
          <LessonForgeWordmark href={null} />
        </div>

        {/* Error Icon */}
        <div className="mt-6 flex justify-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[#FFFBEB]">
            <svg
              className="h-6 w-6 text-[#F59E0B]"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 9v2m0 4v2m0 0v2m0-2v2m9-5a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
          </div>
        </div>

        {/* Error Title */}
        <h1
          className="mt-6 text-center text-2xl font-bold text-[#1E1B4B]"
          style={{ fontFamily: '"Playfair Display", Georgia, serif' }}
        >
          {getErrorTitle(code)}
        </h1>

        {/* Error Description */}
        <p
          className="mt-3 text-center text-[#475569]"
          style={{ fontFamily: '"Trebuchet MS", sans-serif' }}
        >
          {getErrorDescription(code)}
        </p>

        {/* Error Details (for debugging) */}
        {process.env.NODE_ENV === "development" && (
          <div className="mt-6 rounded-lg bg-slate-50 p-4">
            <p className="text-xs font-mono text-slate-600">
              Code: {code}
              <br />
              Stage: {stage}
              <br />
              Message: {message}
            </p>
          </div>
        )}

        {/* Actions */}
        <div className="mt-8 flex flex-col gap-3">
          <Link
            href="/auth/teacher"
            className="inline-flex items-center justify-center rounded-[12px] bg-gradient-to-br from-[#534AB7] to-[#3D35A0] px-4 py-[13px] text-sm font-bold text-white shadow-[0_4px_16px_rgba(83,74,183,0.35)] transition-all duration-200 hover:-translate-y-[1px] hover:shadow-[0_6px_18px_rgba(83,74,183,0.4)]"
            style={{ fontFamily: '"Trebuchet MS", sans-serif' }}
          >
            Try Again
          </Link>
          <Link
            href="/select-role"
            className="inline-flex items-center justify-center rounded-[12px] border-[1.5px] border-[#534AB7] bg-transparent px-4 py-[13px] text-sm font-bold text-[#534AB7] transition-all duration-200 hover:bg-[#EEEDFE]"
            style={{ fontFamily: '"Trebuchet MS", sans-serif' }}
          >
            Change Role
          </Link>
        </div>

        {/* Support Link */}
        <p
          className="mt-6 text-center text-xs text-[#94A3B8]"
          style={{ fontFamily: '"Trebuchet MS", sans-serif' }}
        >
          Still having trouble?{" "}
          <a href="mailto:support@lessonforge.edu" className="font-bold text-[#534AB7] hover:text-[#3D35A0]">
            Contact support
          </a>
        </p>
      </div>
      </div>
    </main>
  );
}

export const dynamic = "force-dynamic";
