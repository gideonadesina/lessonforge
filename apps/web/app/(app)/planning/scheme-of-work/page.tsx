import { redirect } from "next/navigation";
import { createServerSupabase } from "@/lib/supabase/server";
import SchemeOfWorkClient from "@/components/planning/SchemeOfWorkClient";

export default async function SchemeOfWorkPage() {
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  return <SchemeOfWorkClient userId={user.id} />;
}
