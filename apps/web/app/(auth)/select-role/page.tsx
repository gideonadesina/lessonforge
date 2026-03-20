"use client";

import { Building2, GraduationCap } from "lucide-react";
import { useRouter } from "next/navigation";

import LessonForgeWordmark from "@/components/auth/LessonForgeWordmark";
import RoleSelectionCard from "@/components/auth/RoleSelectionCard";
import { ROLE_CONTENT, ROLE_STORAGE_KEY, type AppRole } from "@/lib/auth/roles";

export default function SelectRolePage() {
  const router = useRouter();

  function chooseRole(role: AppRole) {
    if (typeof window !== "undefined") {
      window.localStorage.setItem(ROLE_STORAGE_KEY, role);
    }
    router.push(`/auth/${role}`);
  }

  return (
    <div className="min-h-screen bg-[#f7f2ea] px-5 py-8 sm:px-8 sm:py-12">
      <div className="mx-auto flex w-full max-w-5xl flex-col items-center">
        <LessonForgeWordmark />

        <div className="mt-14 w-full max-w-4xl rounded-[2rem] border border-violet-100/80 bg-white/95 p-6 shadow-[0_30px_70px_-46px_rgba(30,41,59,0.6)] sm:p-10">
          <div className="mx-auto max-w-2xl text-center">
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-violet-700/80">
              Before you continue
            </p>
            <h1 className="mt-3 text-3xl font-semibold tracking-tight text-slate-900 sm:text-4xl">
              How will you use LessonForge?
            </h1>
            <p className="mt-4 text-sm leading-relaxed text-slate-600 sm:text-base">
              Choose your role to enter the right workspace and authentication flow.
            </p>
          </div>

          <div className="mt-10 grid gap-5 md:grid-cols-2">
            <RoleSelectionCard
              title={ROLE_CONTENT.teacher.selectionTitle}
              description={ROLE_CONTENT.teacher.selectionDescription}
              icon={<GraduationCap className="h-6 w-6" aria-hidden="true" />}
              onClick={() => chooseRole("teacher")}
            />
            <RoleSelectionCard
              title={ROLE_CONTENT.principal.selectionTitle}
              description={ROLE_CONTENT.principal.selectionDescription}
              icon={<Building2 className="h-6 w-6" aria-hidden="true" />}
              onClick={() => chooseRole("principal")}
            />
          </div>

          <p className="mt-10 text-center text-xs leading-relaxed text-slate-500">
            By continuing, you agree to LessonForge terms and privacy standards.
          </p>
        </div>
      </div>
    </div>
  );
}