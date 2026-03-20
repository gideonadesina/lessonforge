import type { ReactNode } from "react";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";

import AppFrame from "@/components/layout/AppFrame";
import ForgeGuideLauncher from "@/components/ForgeGuideLauncher";
import "../globals.css";

async function createServerSupabase() {
  const cookieStore = await Promise.resolve(cookies());

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

  if (!url || !anon) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY"
    );
  }

  return createServerClient(url, anon, {
    cookies: {
      getAll() {
        return cookieStore.getAll?.() ?? [];
      },
      setAll(cookiesToSet: Array<{ name: string; value: string; options?: Record<string, unknown> }>) {
        for (const { name, value, options } of cookiesToSet) {
          cookieStore.set?.(name, value, options);
        }
      },
    },
  });
}

export default async function AppLayout({ children }: { children: ReactNode }) {
  const supabase = await createServerSupabase();
  const { data } = await supabase.auth.getUser();
  const userMeta = (data?.user?.user_metadata as { app_role?: string; full_name?: string; name?: string } | null) ?? null;

  const userEmail = data?.user?.email ?? "";
  const appRole = (userMeta?.app_role ?? "").toLowerCase();
  const teacherName =
    userMeta?.full_name ||
    userMeta?.name ||
    userEmail.split("@")[0] ||
    "Teacher";

  if (appRole === "principal") {
    return <>{children}</>;
  }

  return (
    <AppFrame userEmail={userEmail}>
      {children}

      <ForgeGuideLauncher
        teacherName={teacherName}
        userEmail={userEmail}
      />
    </AppFrame>
  );
}