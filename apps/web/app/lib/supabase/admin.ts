import { createClient } from "@supabase/supabase-js";

export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const service = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  return createClient(url, service, {
    auth: { persistSession: false },
  });
}
console.log("SUPABASE_URL exists?", !!process.env.NEXT_PUBLIC_SUPABASE_URL);
console.log("SERVICE_ROLE exists?", !!process.env.SUPABASE_SERVICE_ROLE_KEY);
