import type { ReactNode } from "react";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";

import Sidebar from "@/components/layout/Sidebar";
import Topbar from "@/components/layout/Topbar";
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

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Sidebar handles: desktop fixed + mobile drawer */}
      <Sidebar />
        
         <main className="lg:pl-80">
      <Topbar userEmail={data?.user?.email ?? ""} />
      <div className="mx-auto max-w-6xl px-4 py-6">{children}</div>
    </main>
      {/* IMPORTANT: match Sidebar desktop width (w-80 => lg:pl-80) */}
      <main className="lg:pl-80">
        <div className="mx-auto max-w-6xl px-4 py-6">{children}</div>
      </main>
    </div>
  );
}