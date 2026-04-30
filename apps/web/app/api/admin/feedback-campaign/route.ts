import { NextResponse } from "next/server";
import {
  ADMIN_USER_ID,
  getAdminSessionUserId,
} from "@/lib/admin/metrics";
import {
  getCampaignSnapshot,
  sendCampaignNow,
  sendCampaignTestMode,
} from "@/lib/feedback-campaign";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

async function assertAdmin() {
  const userId = await getAdminSessionUserId();
  return Boolean(userId && userId === ADMIN_USER_ID);
}

export async function GET() {
  if (!(await assertAdmin())) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const snapshot = await getCampaignSnapshot();
  return NextResponse.json(snapshot);
}

export async function POST(request: Request) {
  if (!(await assertAdmin())) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = (await request.json().catch(() => null)) as { mode?: string } | null;
  const result =
    body?.mode === "test"
      ? await sendCampaignTestMode()
      : await sendCampaignNow({ manual: true });
  const snapshot = await getCampaignSnapshot();
  return NextResponse.json({ ...result, snapshot });
}
