import type { ReactNode } from "react";

import LessonForgeWordmark from "@/components/auth/LessonForgeWordmark";

type AuthShellProps = {
  title: string;
  subtitle: string;
  children: ReactNode;
  topRight?: ReactNode;
};

export default function AuthShell({
  title,
  subtitle,
  children,
  topRight,
}: AuthShellProps) {
  return (
    <div className="min-h-screen bg-[#f7f2ea] px-5 py-8 sm:px-8 sm:py-12">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-8">
        <header className="flex items-start justify-between gap-4">
          <LessonForgeWordmark />
          {topRight}
        </header>

        <main className="grid place-items-center">
          <div className="w-full max-w-xl rounded-[2rem] border border-violet-100/80 bg-white/95 p-6 shadow-[0_30px_70px_-46px_rgba(30,41,59,0.6)] sm:p-9">
            <h1 className="text-3xl font-semibold tracking-tight text-slate-900 sm:text-4xl">
              {title}
            </h1>
            <p className="mt-3 text-sm leading-relaxed text-slate-600 sm:text-base">
              {subtitle}
            </p>

            <div className="mt-8">{children}</div>
          </div>
        </main>
      </div>
    </div>
  );
}