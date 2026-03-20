"use client";

import { useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { isAppRole, ROLE_STORAGE_KEY } from "@/lib/auth/roles";
import { createBrowserSupabase } from "@/lib/supabase/browser";

export default function LoginRedirectPage() {
  const router = useRouter();
  const supabase = useMemo(() => createBrowserSupabase(), []);

  useEffect(() => {
    let active = true;

    (async () => {
      const { data, error } = await supabase.auth.getSession();
      console.info("[Auth][login] supabase.auth.getSession response", { data, error });

      if (!active) return;

      if (data.session?.user) {
        router.replace("/dashboard");
        router.refresh();
        return;
      }

      const savedRole = window.localStorage.getItem(ROLE_STORAGE_KEY);
      const role = isAppRole(savedRole) ? savedRole : null;

      if (role) {
        router.replace(`/auth/${role}`);
        return;
      }

      router.replace("/select-role");
    })().catch((err: unknown) => {
      console.error("[Auth][login] Failed to resolve login redirect", err);
      if (!active) return;
      router.replace("/select-role");
    });

    return () => {
      active = false;
    };
  }, [router, supabase]);

  return (
    <div className="grid min-h-screen place-items-center bg-[#f7f2ea] text-sm text-slate-600">
      Preparing your sign in experience...
    </div>
  );
}