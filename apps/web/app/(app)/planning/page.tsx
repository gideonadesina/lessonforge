import { redirect } from "next/navigation";
import { BookOpenCheck, CalendarDays } from "lucide-react";
import { createServerSupabase } from "@/lib/supabase/server";
import PlanningToolCard from "@/components/planning/PlanningToolCard";

export default async function PlanningLandingPage() {
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  return (
    <div className="space-y-5">
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h1 className="text-2xl font-bold text-slate-900">Planning</h1>
        <p className="mt-1 text-sm text-slate-600">
          Keep your weekly teaching and school events organized in one place.
        </p>
      </div>

      <section className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <PlanningToolCard
          href="/planning/scheme-of-work"
          title="Scheme of Work"
          description="Create and manage weekly topics by class, subject, and term."
          icon={BookOpenCheck}
        />
        <PlanningToolCard
          href="/planning/academic-calendar"
          title="Academic Calendar"
          description="Track resumption dates, assessments, meetings, exams, and deadlines."
          icon={CalendarDays}
        />
      </section>
    </div>
  );
}