import { redirect } from "next/navigation";

import RoleAuthScreen from "@/components/auth/RoleAuthScreen";
import { normalizeRole } from "@/lib/auth/roles";

type RoleAuthPageProps = {
  params: Promise<{
    role: string;
  }>;
};

export default async function RoleAuthPage({ params }: RoleAuthPageProps) {
  const { role: rawRole } = await params;
  const role = normalizeRole(rawRole);

  if (!role) {
    redirect("/select-role");
  }

  return <RoleAuthScreen role={role} />;
}