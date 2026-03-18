import { redirect } from "next/navigation";
import { createServerSupabase } from "@/lib/supabase/server";
import SchemeOfWorkClient from "@/components/planning/SchemeOfWorkClient";
import { listSchemeOfWork } from "@/lib/planning/scheme";

export default async function SchemeOfWorkPage() {
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data, error } = await listSchemeOfWork(supabase, user.id);

  return (
    <SchemeOfWorkClient
      userId={user.id}
      initialRows={data}
      initialError={error?.message ?? null}
    />
  );
}
