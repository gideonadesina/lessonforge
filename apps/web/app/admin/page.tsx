import { redirect } from "next/navigation";
import AdminDashboard from "@/components/admin/AdminDashboard";
import {
  ADMIN_USER_ID,
  getAdminDashboardData,
  getAdminSessionUserId,
} from "@/lib/admin/metrics";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function AdminPage() {
  const userId = await getAdminSessionUserId();
  if (!userId || userId !== ADMIN_USER_ID) {
    redirect("/");
  }

  const data = await getAdminDashboardData();
  return <AdminDashboard data={data} />;
}
