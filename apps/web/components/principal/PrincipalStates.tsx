"use client";

import Link from "next/link";

export function PrincipalLoadingState() {
  return (
    <div className="rounded-3xl border border-violet-100 bg-amber-50/70 p-8 text-sm text-slate-700 shadow-sm">
      Loading principal workspace...
    </div>
  );
}

export function PrincipalForbiddenState() {
  return (
    <div className="rounded-3xl border border-red-200 bg-red-50 p-8 shadow-sm">
      <h1 className="text-2xl font-black text-slate-900">Principal access only</h1>
      <p className="mt-2 text-sm text-red-700">This route is restricted to principal and school-admin accounts.</p>
    </div>
  );
}

export function PrincipalOnboardingRequiredState() {
  return (
    <div className="rounded-2xl border border-violet-100 bg-white p-5 shadow-[0_6px_24px_rgba(88,28,135,0.08)]">
      <h2 className="text-lg font-black text-slate-900">Complete your school setup first</h2>
      <p className="mt-2 text-sm text-slate-600">
        Finish onboarding in the principal dashboard before using this page.
      </p>
      <Link
        href="/principal"
        className="mt-4 inline-flex rounded-xl bg-violet-600 px-4 py-2 text-sm font-semibold text-white hover:bg-violet-700"
      >
        Go to /principal
      </Link>
    </div>
  );
}