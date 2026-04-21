import { redirect } from "next/navigation";
import { createServerSupabase } from "@/lib/supabase/server";
import TimetableSetupWizard from "@/components/planning/TimetableSetupWizard";

export default async function TimetableSetupPage({
  searchParams,
}: {
  searchParams?: Promise<{ step?: string }>;
}) {
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const params = (await searchParams) ?? {};
  const parsedStep = Number(params.step ?? "1");
  const initialStep = Number.isFinite(parsedStep)
    ? Math.min(4, Math.max(1, Math.trunc(parsedStep)))
    : 1;

  return <TimetableSetupWizard initialStep={initialStep} />;
}
