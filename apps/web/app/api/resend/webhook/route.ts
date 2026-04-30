import { NextResponse } from "next/server";
import { markCampaignClicked, markCampaignOpened, markCampaignReplied } from "@/lib/feedback-campaign";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

function findEmail(value: unknown): string | null {
  if (!value || typeof value !== "object") return null;
  const record = value as Record<string, unknown>;
  const candidates = [
    record.email,
    record.from,
    record.reply_to,
    record.to,
    record.recipient,
    record.recipient_email,
    record.sender,
  ];

  for (const candidate of candidates) {
    if (typeof candidate === "string" && candidate.includes("@")) {
      const match = candidate.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i);
      if (match) return match[0].toLowerCase();
    }
    if (Array.isArray(candidate)) {
      for (const item of candidate) {
        if (typeof item === "string" && item.includes("@")) {
          const match = item.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i);
          if (match) return match[0].toLowerCase();
        }
      }
    }
  }

  for (const nested of Object.values(record)) {
    const found = findEmail(nested);
    if (found) return found;
  }

  return null;
}

function findResendId(value: unknown): string | null {
  if (!value || typeof value !== "object") return null;
  const record = value as Record<string, unknown>;
  for (const key of ["email_id", "emailId", "message_id", "messageId", "id"]) {
    const item = record[key];
    if (typeof item === "string" && item.trim()) return item.trim();
  }
  for (const nested of Object.values(record)) {
    const found = findResendId(nested);
    if (found) return found;
  }
  return null;
}

export async function POST(request: Request) {
  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON" }, { status: 400 });
  }

  const type = String((payload as Record<string, unknown>)?.type ?? "").toLowerCase();
  const email = findEmail(payload);
  const resendId = findResendId(payload);

  if (type.includes("open")) {
    await markCampaignOpened({ email, resendId });
  }

  if (type.includes("click")) {
    await markCampaignClicked({ email, resendId });
  }

  if (type.includes("reply") || type.includes("inbound")) {
    if (email) await markCampaignReplied(email);
  }

  return NextResponse.json({ ok: true });
}
