import { createAdminClient } from "@/lib/supabase/admin";
import { sendEmail } from "@/lib/emails/send";

const BATCH_SIZE = 15;
const BATCH_DELAY_MS = 2 * 60 * 1000;
const FIRST_EMAIL_DELAY_MS = 24 * 60 * 60 * 1000;
const FOLLOW_UP_DELAY_MS = 3 * 24 * 60 * 60 * 1000;
const SUPPORT_EMAIL = "support@lessonforge.app";
const LOGO_URL = "https://lessonforge.app/lessonforge_logo_horizontal.svg";

export type EmailLogRow = {
  id?: string;
  user_id: string | null;
  teacher_name: string;
  email: string;
  first_email_sent_at: string | null;
  follow_up_sent: boolean;
  follow_up_sent_at: string | null;
  replied: boolean;
  opened?: boolean | null;
  opened_at?: string | null;
  clicked?: boolean | null;
  clicked_at?: string | null;
  first_resend_id?: string | null;
  follow_up_resend_id?: string | null;
  last_error?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
};

export type CampaignStats = {
  totalSent: number;
  totalOpened: number;
  totalReplied: number;
  totalNotReplied: number;
};

export type CampaignSnapshot = {
  logs: EmailLogRow[];
  stats: CampaignStats;
  nextScheduledSend: string | null;
  tableReady: boolean;
  message: string | null;
};

type ProfileForCampaign = {
  id: string;
  full_name: string | null;
  email: string | null;
  created_at?: string | null;
  updated_at?: string | null;
  app_role?: string | null;
};

function nowIso() {
  return new Date().toISOString();
}

function clean(value: unknown, max = 500) {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

function firstName(name: string, email: string) {
  return (name.trim().split(/\s+/)[0] || email.split("@")[0] || "Teacher").trim();
}

function fullName(profile: ProfileForCampaign) {
  return clean(profile.full_name, 160) || clean(profile.email, 160).split("@")[0] || "Teacher";
}

function isMissingTable(error: { message?: string; code?: string } | null | undefined) {
  const message = String(error?.message ?? "").toLowerCase();
  return error?.code === "42P01" || message.includes("email_logs") || message.includes("does not exist");
}

function campaignEmailShell(body: string) {
  return `
    <div style="margin:0;background:#f7f7fb;padding:24px 12px;font-family:Arial,sans-serif;color:#1a1a2e;">
      <div style="max-width:620px;margin:0 auto;background:#ffffff;border:1px solid #e5e7eb;border-radius:16px;padding:28px;">
        <div style="text-align:center;">
          <img src="${LOGO_URL}" alt="LessonForge" style="display:block;margin:0 auto;max-width:150px;width:100%;height:auto;" />
        </div>
        <div style="border-top:1px solid #e5e7eb;margin:22px 0 24px;"></div>
        <div style="line-height:1.7;font-size:15px;">
          ${body}
        </div>
        <div style="border-top:1px solid #e5e7eb;margin:24px 0 16px;"></div>
        <div style="text-align:center;color:#6b7280;font-size:12px;line-height:1.6;">
          LessonForge | lessonforge.app | support@lessonforge.app
        </div>
      </div>
    </div>
  `;
}

function firstEmailHtml(name: string, email: string) {
  const first = firstName(name, email);
  return campaignEmailShell(`
    <div style="font-family:Arial,sans-serif;color:#1a1a2e;line-height:1.7;font-size:15px;">
      <p>Hi ${first},</p>
      <p>My name is Gideon Adesina — I'm the founder of LessonForge.</p>
      <p>I built it because teachers across Africa were losing hours every week to formatting lesson plans instead of actually teaching. That felt wrong, so I decided to do something about it.</p>
      <p>You're one of our first users — and that means everything to me.</p>
      <p>I'm reaching out personally because your honest opinion will shape what we build next.</p>
      <p>Two quick questions:</p>
      <ol>
        <li>Did LessonForge actually save you time preparing lessons?</li>
        <li>What's the ONE thing missing that would make you use it every single week?</li>
      </ol>
      <p>Just hit reply — no forms, no surveys. Your words come straight to me.</p>
      <p>Thank you for being one of the first.</p>
      <p>— Gideon Adesina<br/>Founder, LessonForge<br/>lessonforge.app | support@lessonforge.app</p>
    </div>
  `);
}

function followUpHtml(name: string, email: string) {
  const first = firstName(name, email);
  return campaignEmailShell(`
    <div style="font-family:Arial,sans-serif;color:#1a1a2e;line-height:1.7;font-size:15px;">
      <p>Hi ${first},</p>
      <p>I sent you a note a few days ago and just wanted to follow up one last time.</p>
      <p>I'm building LessonForge specifically for African teachers and your honest feedback — even just one sentence — would mean the world to me right now.</p>
      <p>What's the ONE thing that would make LessonForge a tool you use every single week?</p>
      <p>Just hit reply. That's it.</p>
      <p>Thank you so much</p>
      <p>— Gideon Adesina<br/>Founder, LessonForge<br/>lessonforge.app | support@lessonforge.app</p>
    </div>
  `);
}

async function readLogs() {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("email_logs")
    .select("*")
    .order("first_email_sent_at", { ascending: false, nullsFirst: false });

  if (error) {
    if (isMissingTable(error)) {
      return { logs: [] as EmailLogRow[], tableReady: false, error: null };
    }
    return { logs: [] as EmailLogRow[], tableReady: true, error: error.message };
  }

  return { logs: (data ?? []) as EmailLogRow[], tableReady: true, error: null };
}

async function readProfiles() {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("profiles")
    .select("id, email, full_name, updated_at, app_role")
    .not("email", "is", null);

  if (error) {
    console.error("[feedback-campaign] profile query failed:", error.message);
    return [] as ProfileForCampaign[];
  }

  return ((data ?? []) as ProfileForCampaign[]).filter((profile) => clean(profile.email, 180));
}

function calculateStats(logs: EmailLogRow[]): CampaignStats {
  const sent = logs.filter((log) => Boolean(log.first_email_sent_at));
  return {
    totalSent: sent.length,
    totalOpened: logs.filter((log) => Boolean(log.opened)).length,
    totalReplied: logs.filter((log) => Boolean(log.replied)).length,
    totalNotReplied: sent.filter((log) => !log.replied).length,
  };
}

function calculateNextScheduledSend(logs: EmailLogRow[], profiles: ProfileForCampaign[]) {
  const now = Date.now();
  const loggedEmails = new Set(logs.map((log) => log.email.toLowerCase()));
  const nextFirst = profiles
    .filter((profile) => !loggedEmails.has(clean(profile.email, 180).toLowerCase()))
    .map((profile) => new Date(profile.created_at ?? profile.updated_at ?? now).getTime() + FIRST_EMAIL_DELAY_MS)
    .filter((time) => Number.isFinite(time))
    .sort((a, b) => a - b)[0];

  const nextFollowUp = logs
    .filter((log) => log.first_email_sent_at && !log.follow_up_sent && !log.replied)
    .map((log) => new Date(log.first_email_sent_at as string).getTime() + FOLLOW_UP_DELAY_MS)
    .filter((time) => Number.isFinite(time))
    .sort((a, b) => a - b)[0];

  const lastBatchTime = logs
    .flatMap((log) => [log.first_email_sent_at, log.follow_up_sent_at])
    .filter(Boolean)
    .map((value) => new Date(value as string).getTime())
    .filter((time) => Number.isFinite(time))
    .sort((a, b) => b - a)[0];
  const batchGate = lastBatchTime ? lastBatchTime + BATCH_DELAY_MS : null;

  const next = [nextFirst, nextFollowUp, batchGate]
    .filter((value): value is number => typeof value === "number" && Number.isFinite(value))
    .map((value) => Math.max(value, now))
    .sort((a, b) => a - b)[0];

  return next ? new Date(next).toISOString() : null;
}

export async function getCampaignStats(): Promise<CampaignStats> {
  const { logs } = await readLogs();
  return calculateStats(logs);
}

export async function getCampaignSnapshot(): Promise<CampaignSnapshot> {
  const [{ logs, tableReady, error }, profiles] = await Promise.all([readLogs(), readProfiles()]);
  return {
    logs,
    stats: calculateStats(logs),
    nextScheduledSend: tableReady ? calculateNextScheduledSend(logs, profiles) : null,
    tableReady,
    message: error ?? (!tableReady ? "email_logs table is not available yet. Apply the SQL schema before sending." : null),
  };
}

async function upsertError(profile: ProfileForCampaign, error: unknown) {
  const admin = createAdminClient();
  await admin.from("email_logs").upsert(
    {
      user_id: profile.id,
      teacher_name: fullName(profile),
      email: clean(profile.email, 180).toLowerCase(),
      follow_up_sent: false,
      replied: false,
      last_error: error instanceof Error ? error.message : String(error),
    },
    { onConflict: "email" }
  );
}

async function sendFirstEmail(profile: ProfileForCampaign) {
  const admin = createAdminClient();
  const email = clean(profile.email, 180).toLowerCase();
  const name = fullName(profile);
  const sentAt = nowIso();
  const sent = await sendEmail({
    to: email,
    subject: "A personal note from the founder of LessonForge",
    html: firstEmailHtml(name, email),
    replyTo: SUPPORT_EMAIL,
  });

  await admin.from("email_logs").upsert(
    {
      user_id: profile.id,
      teacher_name: name,
      email,
      first_email_sent_at: sent ? sentAt : null,
      follow_up_sent: false,
      follow_up_sent_at: null,
      replied: false,
      last_error: sent ? null : "Resend returned false while sending first campaign email.",
    },
    { onConflict: "email" }
  );
}

async function sendFollowUp(log: EmailLogRow) {
  const admin = createAdminClient();
  const email = clean(log.email, 180).toLowerCase();
  const name = clean(log.teacher_name, 160) || email.split("@")[0] || "Teacher";
  const sentAt = nowIso();
  const sent = await sendEmail({
    to: email,
    subject: "Still would love to hear from you",
    html: followUpHtml(name, email),
    replyTo: SUPPORT_EMAIL,
  });

  const { error } = await admin
    .from("email_logs")
    .update({
      follow_up_sent: sent,
      follow_up_sent_at: sent ? sentAt : log.follow_up_sent_at,
      last_error: sent ? null : "Resend returned false while sending follow-up email.",
    })
    .eq("email", email);

  if (error) console.error("[feedback-campaign] follow-up log update failed:", error.message);
}

export async function sendCampaignNow(options: { manual?: boolean } = {}) {
  const [{ logs, tableReady, error }, profiles] = await Promise.all([readLogs(), readProfiles()]);
  if (!tableReady) {
    return { ok: false, sent: 0, message: "email_logs table is not available yet. Apply the SQL schema first." };
  }
  if (error) {
    return { ok: false, sent: 0, message: error };
  }

  const now = Date.now();
  const loggedByEmail = new Map(logs.map((log) => [log.email.toLowerCase(), log]));
  const lastBatchTime = logs
    .flatMap((log) => [log.first_email_sent_at, log.follow_up_sent_at])
    .filter(Boolean)
    .map((value) => new Date(value as string).getTime())
    .filter((time) => Number.isFinite(time))
    .sort((a, b) => b - a)[0];

  if (!options.manual && lastBatchTime && now - lastBatchTime < BATCH_DELAY_MS) {
    return {
      ok: true,
      sent: 0,
      message: "Waiting for the 2 minute batch delay window.",
    };
  }

  const firstDue = profiles.filter((profile) => {
    const email = clean(profile.email, 180).toLowerCase();
    if (!email || loggedByEmail.has(email)) return false;
    if (options.manual) return true;
    const createdAt = new Date(profile.created_at ?? profile.updated_at ?? 0).getTime();
    return Number.isFinite(createdAt) && now - createdAt >= FIRST_EMAIL_DELAY_MS;
  });

  const followUpDue = logs.filter((log) => {
    if (!log.first_email_sent_at || log.follow_up_sent || log.replied) return false;
    const firstSent = new Date(log.first_email_sent_at).getTime();
    return Number.isFinite(firstSent) && now - firstSent >= FOLLOW_UP_DELAY_MS;
  });

  const batch = [
    ...followUpDue.map((log) => ({ type: "followup" as const, log })),
    ...firstDue.map((profile) => ({ type: "first" as const, profile })),
  ].slice(0, BATCH_SIZE);

  let sent = 0;
  for (const item of batch) {
    try {
      if (item.type === "first") {
        await sendFirstEmail(item.profile);
      } else {
        await sendFollowUp(item.log);
      }
      sent += 1;
    } catch (error) {
      console.error("[feedback-campaign] send failed:", error);
      if (item.type === "first") await upsertError(item.profile, error);
    }
  }

  return {
    ok: true,
    sent,
    message: sent ? `Sent ${sent} feedback email(s).` : "No campaign emails are due right now.",
  };
}

export async function sendCampaignTestMode() {
  const testEmail = process.env.ADMIN_TEST_EMAIL?.trim();
  if (!testEmail) {
    return {
      ok: false,
      sent: 0,
      message: "ADMIN_TEST_EMAIL is not set. Set it in Vercel before sending test campaign emails.",
    };
  }

  const name = "Gideon Adesina";
  const firstSent = await sendEmail({
    to: testEmail,
    subject: "[TEST] A personal note from the founder of LessonForge",
    html: firstEmailHtml(name, testEmail),
    replyTo: SUPPORT_EMAIL,
  });
  const followUpSent = await sendEmail({
    to: testEmail,
    subject: "[TEST] Still would love to hear from you",
    html: followUpHtml(name, testEmail),
    replyTo: SUPPORT_EMAIL,
  });

  return {
    ok: firstSent && followUpSent,
    sent: Number(firstSent) + Number(followUpSent),
    message:
      firstSent && followUpSent
        ? `Sent test first and follow-up emails to ${testEmail}.`
        : `Could not send all test emails to ${testEmail}. Check RESEND_API_KEY and Resend logs.`,
  };
}

export async function markCampaignOpened(identifier: { email?: string | null; resendId?: string | null }) {
  const admin = createAdminClient();
  const query = admin
    .from("email_logs")
    .update({ opened: true, opened_at: nowIso() });

  if (identifier.email) return query.eq("email", identifier.email.toLowerCase());
  if (identifier.resendId) return query.or(`first_resend_id.eq.${identifier.resendId},follow_up_resend_id.eq.${identifier.resendId}`);
  return { error: null };
}

export async function markCampaignClicked(identifier: { email?: string | null; resendId?: string | null }) {
  const admin = createAdminClient();
  const query = admin
    .from("email_logs")
    .update({ clicked: true, clicked_at: nowIso() });

  if (identifier.email) return query.eq("email", identifier.email.toLowerCase());
  if (identifier.resendId) return query.or(`first_resend_id.eq.${identifier.resendId},follow_up_resend_id.eq.${identifier.resendId}`);
  return { error: null };
}

export async function markCampaignReplied(email: string) {
  const cleaned = clean(email, 180).toLowerCase();
  if (!cleaned) return;
  const admin = createAdminClient();
  const { error } = await admin
    .from("email_logs")
    .update({ replied: true })
    .eq("email", cleaned);

  if (error) console.error("[feedback-campaign] reply update failed:", error.message);
}
