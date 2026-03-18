import { redirect } from "next/navigation";

import { normalizeAuthRole } from "@/lib/auth/roles";

import RoleAuthScreen from "./RoleAuthScreen";

type RoleAuthPageProps = {
  params: Promise<{
    role: string;
  }>;
};

export default async function RoleAuthPage({ params }: RoleAuthPageProps) {
  const { role: rawRole } = await params;
  const role = normalizeAuthRole(rawRole);

  if (!role) {
    redirect("/select-role");
  }

  return <RoleAuthScreen role={role} />;
}
