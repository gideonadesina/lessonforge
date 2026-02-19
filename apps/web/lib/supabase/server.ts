import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";

export async function createServerSupabase() {
  // Works whether cookies() returns value or Promise (Next versions differ)
  const cookieStore: any = await Promise.resolve(cookies());

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

  if (!url || !anon) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY");
  }

  return createServerClient(url, anon, {
    cookies: {
      // Preferred API used by @supabase/ssr
      getAll() {
        return cookieStore.getAll?.() ?? [];
      },
      setAll(cookiesToSet) {
        for (const { name, value, options } of cookiesToSet) {
          cookieStore.set?.(name, value, options);
        }
      },
    },
  });
}
