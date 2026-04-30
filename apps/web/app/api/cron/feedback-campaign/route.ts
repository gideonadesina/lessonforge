import { NextResponse } from "next/server";
import { getCampaignSnapshot, sendCampaignNow } from "@/lib/feedback-campaign";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const auth = request.headers.get("authorization") ?? "";
    if (auth !== `Bearer ${secret}`) {
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }
  }

  const result = await sendCampaignNow();
  const snapshot = await getCampaignSnapshot();
  return NextResponse.json({ ...result, nextScheduledSend: snapshot.nextScheduledSend });
}

export async function POST(request: Request) {
  return GET(request);
}
