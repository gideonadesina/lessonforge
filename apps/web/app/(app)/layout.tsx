import type { ReactNode } from "react";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";

import AppFrame from "@/components/layout/AppFrame";
import ForgeGuideLauncher from "@/components/ForgeGuideLauncher";
import "../globals.css";

async function createServerSupabase() {
  const cookieStore: any = await Promise.resolve(cookies());

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
      setAll(cookiesToSet: any[]) {
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

  const userEmail = data?.user?.email ?? "";
  const teacherName =
    (data?.user?.user_metadata as any)?.full_name ||
    (data?.user?.user_metadata as any)?.name ||
    userEmail.split("@")[0] ||
    "Teacher";

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