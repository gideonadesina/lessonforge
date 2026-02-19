import type { ReactNode } from "react";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";

import AppShell from "@/components/layout/AppShell";
import "../globals.css";


async function createServerSupabase() {
  // Works whether cookies() returns value or Promise (Next versions differ)
  const cookieStore: any = await Promise.resolve(cookies());

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

  console.log("AppShell typeof:", typeof AppShell, AppShell);

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

  const email = data?.user?.email ?? "";
  return <AppShell userEmail={email}>{children}</AppShell>;
}
