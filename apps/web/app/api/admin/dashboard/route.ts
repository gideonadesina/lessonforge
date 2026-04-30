import { NextResponse } from "next/server";
import {
  ADMIN_USER_ID,
  getAdminDashboardData,
  getAdminSessionUserId,
} from "@/lib/admin/metrics";

export const dynamic = "force-dynamic";

export async function GET() {
  const userId = await getAdminSessionUserId();
  if (!userId || userId !== ADMIN_USER_ID) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const data = await getAdminDashboardData();
  return NextResponse.json(data);
}
