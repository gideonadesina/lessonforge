"use client";

import { createClient as createSupabaseClient } from "@supabase/supabase-js";

export function createClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

  console.log("SUPABASE_URL", process.env.NEXT_PUBLIC_SUPABASE_URL);
console.log("SUPABASE_ANON", process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ? "present" : "missing");


  if (!url || !anon) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY");
  }

  return createSupabaseClient(url, anon, {
    auth: {
      persistSession: true,      // uses browser storage
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  });
}
