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
        const user = data.session?.user ?? null;
        setIsAuthenticated(Boolean(user));

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

        if (!roleContext.availableRoles.length || role === "principal") {
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
    <div className="min-h-screen bg-[#FAF9F6] px-5 py-8 sm:px-8 sm:py-12">
      <div className="mx-auto flex w-full max-w-5xl flex-col items-center">
        <LessonForgeWordmark />

        <div className="mt-14 w-full max-w-4xl rounded-[20px] border border-[#E2E8F0] bg-white p-6 shadow-[0_4px_24px_rgba(83,74,183,0.08)] sm:p-10">
          <div className="mx-auto max-w-2xl text-center">
            <p
              className="text-[11px] uppercase tracking-[2.5px] text-[#534AB7]"
              style={{ fontFamily: '"Trebuchet MS", sans-serif' }}
            >
              Before you continue
            </p>
            <h1
              className="mt-3 text-3xl font-bold tracking-tight text-[#1E1B4B] sm:text-4xl"
              style={{ fontFamily: '"Playfair Display", Georgia, serif' }}
            >
              How will you use LessonForge?
            </h1>
            <p
              className="mt-4 text-sm leading-relaxed text-[#475569] sm:text-base"
              style={{ fontFamily: '"Trebuchet MS", sans-serif' }}
            >
              Choose your role to enter the right workspace and authentication flow.
            </p>
          </div>

          <div className="mt-10 grid gap-5 md:grid-cols-2">
            <RoleSelectionCard
              title="Teacher"
              badge="Free to start"
              badgeTone="teacher"
              description="Generate lesson plans, notes, slides and exams for your own classes. No payment needed to get started."
              icon={<GraduationCap className="h-6 w-6" aria-hidden="true" />}
              busy={switchingRole === "teacher"}
              tone="teacher"
              onClick={() => chooseRole("teacher")}
            />
            <RoleSelectionCard
              title="Principal / School Admin"
              badge="School Plan Required"
              badgeTone="purple"
              description="Buy credits once for your entire school. All your teachers generate lessons from your school credit pool. You get a school code to invite unlimited teachers - no individual teacher payments needed."
              icon={<Building2 className="h-6 w-6" aria-hidden="true" />}
              busy={switchingRole === "principal"}
              tone="principal"
              onClick={() => chooseRole("principal")}
            />
          </div>

          {message ? (
            <div
              className="mt-6 rounded-[14px] border px-4 py-3 text-sm"
              style={{
                background: "rgba(83,74,183,0.10)",
                borderColor: "rgba(83,74,183,0.25)",
                color: "#1E1B4B",
                fontFamily: '"Trebuchet MS", sans-serif',
              }}
            >
              {message}
            </div>
          ) : null}

          <p
            className="mt-10 text-center text-xs leading-relaxed text-[#94A3B8]"
            style={{ fontFamily: '"Trebuchet MS", sans-serif' }}
          >
            By continuing, you agree to LessonForge terms and privacy standards.
          </p>
        </div>
      </div>
    </div>
  );
}
