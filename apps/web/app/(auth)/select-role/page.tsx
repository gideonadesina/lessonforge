"use client";

import { useEffect, useMemo, useState } from "react";
import { Building2, GraduationCap } from "lucide-react";
import { useRouter } from "next/navigation";

import LessonForgeWordmark from "@/components/auth/LessonForgeWordmark";
import RoleSelectionCard from "@/components/auth/RoleSelectionCard";
import {
  ROLE_CONTENT,
  getRoleHomePath,
  persistActiveRole,
  type AppRole,
} from "@/lib/auth/roles";
import { fetchRoleContext, switchRole as switchRoleApi } from "@/lib/auth/client";
import { createBrowserSupabase } from "@/lib/supabase/browser";

export default function SelectRolePage() {
  const router = useRouter();
  const supabase = useMemo(() => createBrowserSupabase(), []);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [loadingRoleContext, setLoadingRoleContext] = useState(true);
  const [switchingRole, setSwitchingRole] = useState<AppRole | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const { data } = await supabase.auth.getSession();
        if (!alive) return;
        setIsAuthenticated(Boolean(data.session));
      } finally {
        if (alive) setLoadingRoleContext(false);
      }
    })();

    return () => {
      alive = false;
    };
  }, [supabase]);

  async function chooseRole(role: AppRole) {
    setMessage(null);
    setSwitchingRole(role);
    try {
      persistActiveRole(role);

      if (!loadingRoleContext && isAuthenticated) {
        const roleContext = await fetchRoleContext();
        if (roleContext.availableRoles.includes(role)) {
          const result = await switchRoleApi(role);
          window.location.href = result.homePath;
          return;
        }

        if (!roleContext.availableRoles.length) {
          const result = await switchRoleApi(role, { claimIfUnprovisioned: true });
          window.location.href = result.homePath;
          return;
        }

        setMessage(
          `Your account does not have ${ROLE_CONTENT[role].label.toLowerCase()} access yet.`
        );
        router.push(getRoleHomePath(roleContext.activeRole ?? roleContext.availableRoles[0] ?? role));
        return;
      }

      router.push(`/auth/${role}`);
    } catch {
      router.push(`/auth/${role}`);
    } finally {
      setSwitchingRole(null);
    }
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
              busy={switchingRole === "teacher"}
              onClick={() => chooseRole("teacher")}
            />
            <RoleSelectionCard
              title={ROLE_CONTENT.principal.selectionTitle}
              description={ROLE_CONTENT.principal.selectionDescription}
              icon={<Building2 className="h-6 w-6" aria-hidden="true" />}
              busy={switchingRole === "principal"}
              onClick={() => chooseRole("principal")}
            />
          </div>

          {message ? (
            <div className="mt-6 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
              {message}
            </div>
          ) : null}

          <p className="mt-10 text-center text-xs leading-relaxed text-slate-500">
            By continuing, you agree to LessonForge terms and privacy standards.
          </p>
        </div>
      </div>
    </div>
  );
}