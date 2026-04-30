import { NextResponse } from "next/server";
import {
  ADMIN_USER_ID,
  getAdminSessionUserId,
} from "@/lib/admin/metrics";
import { getCampaignSnapshot } from "@/lib/feedback-campaign";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

function csvCell(value: unknown) {
  const text = String(value ?? "");
  return `"${text.replace(/"/g, '""')}"`;
}

export async function GET() {
  const userId = await getAdminSessionUserId();
  if (!userId || userId !== ADMIN_USER_ID) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const snapshot = await getCampaignSnapshot();
  const headers = [
    "Name",
    "Email",
    "First Email Sent",
    "Follow-up Sent",
    "Follow-up Sent At",
    "Opened",
    "Clicked",
    "Replied",
  ];
  const lines = [
    headers.map(csvCell).join(","),
    ...snapshot.logs.map((log) =>
      [
        log.teacher_name,
        log.email,
        log.first_email_sent_at,
        log.follow_up_sent ? "true" : "false",
        log.follow_up_sent_at,
        log.opened ? "true" : "false",
        log.clicked ? "true" : "false",
        log.replied ? "true" : "false",
      ]
        .map(csvCell)
        .join(",")
    ),
  ];

  return new NextResponse(lines.join("\n"), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": "attachment; filename=\"lessonforge-feedback-campaign.csv\"",
    },
  });
}
