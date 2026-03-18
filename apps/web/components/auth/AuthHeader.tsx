import type { AuthRole } from "@/lib/auth/roles";
import { AUTH_ROLE_CONFIG } from "@/lib/auth/roles";

type AuthHeaderProps = {
  role: AuthRole;
};

export default function AuthHeader({ role }: AuthHeaderProps) {
  const config = AUTH_ROLE_CONFIG[role];

  return (
    <header className="space-y-4">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-600 to-violet-600 shadow-sm">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="text-white"
            aria-hidden
          >
            <path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20" />
          </svg>
        </div>
        <div className="leading-tight">
          <div className="text-base font-semibold text-slate-900">LessonForge</div>
          <div className="text-[11px] uppercase tracking-[0.14em] text-slate-500">
            SCHOOL WORKSPACE
          </div>
        </div>
      </div>

      <div className="space-y-2">
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-indigo-700/90">
          {config.indicator}
        </p>
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
          {config.heading}
        </h1>
        <p className="text-sm leading-relaxed text-slate-600">{config.subtext}</p>
      </div>
    </header>
  );
}
