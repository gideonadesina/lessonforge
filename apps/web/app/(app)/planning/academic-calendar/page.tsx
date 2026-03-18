import { redirect } from "next/navigation";
import { createServerSupabase } from "@/lib/supabase/server";
import AcademicCalendarClient from "@/components/planning/AcademicCalendarClient";

export default async function AcademicCalendarPage() {
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  return <AcademicCalendarClient userId={user.id} />;
}
