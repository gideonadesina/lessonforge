/**
 * Auth Error Page
 * Displays authentication errors with helpful messaging and recovery options.
 */

import Link from "next/link";

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
      <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
        {/* Error Icon */}
        <div className="flex justify-center">
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
                d="M12 9v2m0 4v2m0 0v2m0-2v2m9-5a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
          </div>
        </div>

        {/* Error Title */}
        <h1 className="mt-6 text-center text-2xl font-bold text-slate-900">
          {getErrorTitle(code)}
        </h1>

        {/* Error Description */}
        <p className="mt-3 text-center text-slate-600">{getErrorDescription(code)}</p>

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
            className="inline-flex items-center justify-center rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 px-4 py-2.5 text-sm font-semibold text-white shadow-md shadow-indigo-300/50 transition hover:from-indigo-500 hover:to-violet-500"
          >
            Try Again
          </Link>
          <Link
            href="/select-role"
            className="inline-flex items-center justify-center rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
          >
            Change Role
          </Link>
        </div>

        {/* Support Link */}
        <p className="mt-6 text-center text-xs text-slate-500">
          Still having trouble?{" "}
          <a href="mailto:support@lessonforge.edu" className="font-medium text-indigo-700 hover:text-indigo-600">
            Contact support
          </a>
        </p>
      </div>
    </main>
  );
}

export const dynamic = "force-dynamic";
