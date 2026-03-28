import { redirect } from "next/navigation";
import { normalizeRole } from "@/lib/auth/roles";

type LegacyRolePageProps = {
  params: Promise<{
    role: string;
  }>;
};

export default async function LegacyRolePage({ params }: LegacyRolePageProps) {
  const { role: rawRole } = await params;
  const role = normalizeRole(rawRole);

  if (!role) {
    redirect("/select-role");
  }

  redirect(`/auth/${role}`);
}