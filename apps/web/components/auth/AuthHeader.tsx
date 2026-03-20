import Link from "next/link";
import { GraduationCap, School2 } from "lucide-react";

import LessonForgeWordmark from "@/components/auth/LessonForgeWordmark";
import type { AppRole } from "@/lib/auth/roles";
import { ROLE_CONTENT } from "@/lib/auth/roles";

type AuthHeaderProps = {
  role: AppRole;
};

export default function AuthHeader({ role }: AuthHeaderProps) {
  const config = ROLE_CONTENT[role];

  const roleTitle =
    role === "principal" ? "Principal / School Admin" : "Teacher";

  const roleDescription =
    role === "principal"
      ? "Sign in to manage teachers, school planning, and curriculum visibility."
      : "Sign in to create lesson plans, worksheets, exams, and classroom resources.";

  const Icon = role === "principal" ? School2 : GraduationCap;

  return (
    <header className="space-y-5">
      <div className="flex justify-center">
        <LessonForgeWordmark href="/" />
      </div>

      <div className="flex items-start gap-4 rounded-2xl border border-violet-100 bg-violet-50/70 p-4">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-white text-violet-700 shadow-sm">
          <Icon className="h-6 w-6" />
        </div>

        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-violet-700/80">
            {config.label} access
          </p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-slate-900 sm:text-[1.9rem]">
            Continue as {roleTitle}
          </h1>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            {roleDescription}
          </p>
        </div>
      </div>

      <div className="text-center text-sm text-slate-500">
        Selected the wrong workspace?{" "}
        <Link
          href="/select-role"
          className="font-medium text-violet-700 transition hover:text-violet-600"
        >
          Change role
        </Link>
      </div>
    </header>
  );
}