import { redirect } from "next/navigation";
import { createServerSupabase } from "@/lib/supabase/server";
import AcademicCalendarClient from "@/components/planning/AcademicCalendarClient";
import { listAcademicEvents } from "@/lib/planning/academicCalender";

export default async function AcademicCalendarPage() {
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data, error } = await listAcademicEvents(supabase, user.id);

  return (
    <AcademicCalendarClient
      userId={user.id}
      initialRows={data}
      initialError={error?.message ?? null}
    />
  );
}