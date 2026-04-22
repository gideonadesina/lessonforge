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
        <LessonForgeWordmark href={null} />
      </div>

      <div className="flex items-start gap-4 rounded-[20px] border border-[#E2E8F0] bg-[#EEEDFE]/70 p-4">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-[12px] bg-white text-[#534AB7] shadow-sm">
          <Icon className="h-6 w-6" />
        </div>

        <div className="min-w-0">
          <p
            className="text-[11px] uppercase tracking-[2.5px] text-[#534AB7]"
            style={{ fontFamily: '"Trebuchet MS", sans-serif' }}
          >
            {config.label} access
          </p>
          <h1
            className="mt-1 text-2xl font-bold tracking-tight text-[#1E1B4B] sm:text-[1.9rem]"
            style={{ fontFamily: '"Playfair Display", Georgia, serif' }}
          >
            Continue as {roleTitle}
          </h1>
          <p
            className="mt-2 text-sm leading-6 text-[#475569]"
            style={{ fontFamily: '"Trebuchet MS", sans-serif' }}
          >
            {roleDescription}
          </p>
        </div>
      </div>

      <div
        className="text-center text-sm text-[#475569]"
        style={{ fontFamily: '"Trebuchet MS", sans-serif' }}
      >
        Selected the wrong workspace?{" "}
        <Link
          href="/select-role"
          className="font-bold text-[#534AB7] transition hover:text-[#3D35A0]"
        >
          Change role
        </Link>
      </div>
    </header>
  );
}