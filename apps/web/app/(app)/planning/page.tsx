import { redirect } from "next/navigation";
import { createServerSupabase } from "@/lib/supabase/server";
import PlanningDashboardClient from "@/components/planning/PlanningDashboardClient";

export default async function PlanningLandingPage() {
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const dateLabel = new Date().toLocaleDateString(undefined, {
    weekday: "long",
    day: "numeric",
    month: "long",
  });

  return (
    <PlanningDashboardClient
      initialDateLabel={dateLabel}
      initialTermLabel="Current term"
    />
  );
}