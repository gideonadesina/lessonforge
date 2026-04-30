import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { sendEmail } from "@/lib/emails/send";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

type HelpBody = {
  name?: unknown;
  email?: unknown;
  message?: unknown;
  userId?: unknown;
  plan?: unknown;
};

function clean(value: unknown, max = 500) {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function isEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

async function readUser(req: NextRequest) {
  const auth = req.headers.get("authorization") ?? "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
  if (!token) return null;

  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        auth: {
          persistSession: false,
          autoRefreshToken: false,
          detectSessionInUrl: false,
        },
        global: { headers: { Authorization: `Bearer ${token}` } },
      }
    );
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) return null;
    return data.user;
  } catch {
    return null;
  }
}

function emailBase(content: string) {
  return `<!DOCTYPE html>
<html>
  <body style="margin:0;background:#f4f4f8;font-family:Helvetica,Arial,sans-serif;">
    <div style="max-width:560px;margin:0 auto;padding:24px;">
      <div style="background:#ffffff;border:1px solid #e5e7eb;border-radius:16px;overflow:hidden;">
        <div style="background:#6C63FF;color:#fff;padding:20px 24px;font-weight:800;font-size:18px;">LessonForge</div>
        <div style="padding:28px 24px;color:#1a1a2e;line-height:1.7;font-size:15px;">
          ${content}
        </div>
        <div style="padding:16px 24px;border-top:1px solid #eef2f7;color:#9ca3af;font-size:12px;text-align:center;">
          Built for African classrooms<br/>
          support@lessonforge.app
        </div>
      </div>
    </div>
  </body>
</html>`;
}

function supportEmail({
  name,
  email,
  message,
  userId,
  plan,
  timestamp,
}: {
  name: string;
  email: string;
  message: string;
  userId: string;
  plan: string;
  timestamp: string;
}) {
  return emailBase(`
    <p style="margin:0 0 16px;">New feedback from <strong>${escapeHtml(name)}</strong>.</p>
    <p style="margin:0 0 16px;"><strong>Email:</strong> ${escapeHtml(email)}</p>
    <p style="margin:0 0 16px;"><strong>User ID:</strong> ${escapeHtml(userId || "Not available")}</p>
    <p style="margin:0 0 16px;"><strong>Plan:</strong> ${escapeHtml(plan || "free")}</p>
    <p style="margin:0 0 16px;"><strong>Timestamp:</strong> ${escapeHtml(timestamp)}</p>
    <div style="background:#f9f8ff;border:1px solid #e5e7eb;border-radius:12px;padding:16px;white-space:pre-wrap;">${escapeHtml(message)}</div>
  `);
}

function confirmationEmail(firstName: string) {
  return emailBase(`
    <p style="margin:0 0 16px;">Hi ${escapeHtml(firstName)},</p>
    <p style="margin:0 0 16px;">Thank you for reaching out to us.</p>
    <p style="margin:0 0 16px;">We have received your message and our team will review it personally. We will get back to you within 24 hours.</p>
    <p style="margin:0 0 16px;">Your feedback helps us make LessonForge better for every teacher across Africa. We genuinely appreciate you taking the time to write to us.</p>
    <p style="margin:0 0 16px;">If your issue is urgent, you can also reach us directly at <strong>support@lessonforge.app</strong></p>
    <p style="margin:0 0 16px;">Keep teaching, keep inspiring.</p>
    <p style="margin:0 0 0;">— The LessonForge Team<br/>Built for African classrooms<br/>support@lessonforge.app</p>
  `);
}

function notificationEmail({
  name,
  email,
  message,
  plan,
  timestamp,
}: {
  name: string;
  email: string;
  message: string;
  plan: string;
  timestamp: string;
}) {
  return emailBase(`
    <p style="margin:0 0 16px;">New feedback from <strong>${escapeHtml(name)}</strong> — LessonForge.</p>
    <p style="margin:0 0 10px;"><strong>Name:</strong> ${escapeHtml(name)}</p>
    <p style="margin:0 0 10px;"><strong>Email:</strong> ${escapeHtml(email)}</p>
    <p style="margin:0 0 10px;"><strong>Plan:</strong> ${escapeHtml(plan || "free")}</p>
    <p style="margin:0 0 10px;"><strong>Timestamp:</strong> ${escapeHtml(timestamp)}</p>
    <p style="margin:16px 0 10px;"><strong>Message:</strong></p>
    <div style="background:#f9f8ff;border:1px solid #e5e7eb;border-radius:12px;padding:16px;white-space:pre-wrap;">${escapeHtml(message)}</div>
  `);
}

export async function POST(req: NextRequest) {
  let body: HelpBody;
  try {
    body = (await req.json()) as HelpBody;
  } catch {
    return NextResponse.json(
      { ok: false, message: "Please fill out the form and try again." },
      { status: 400 }
    );
  }

  const authedUser = await readUser(req);
  const name = clean(body.name, 120) || clean(authedUser?.user_metadata?.full_name, 120) || clean(authedUser?.user_metadata?.name, 120) || "LessonForge user";
  const email = clean(body.email, 180) || authedUser?.email || "";
  const message = clean(body.message, 6000);
  const userId = clean(body.userId, 120) || authedUser?.id || "";
  const plan = clean(body.plan, 120) || "free";
  const timestamp = new Date().toISOString();

  if (!name) {
    return NextResponse.json({ ok: false, message: "Please enter your name." }, { status: 400 });
  }

  if (!email || !isEmail(email)) {
    return NextResponse.json(
      { ok: false, message: "Please enter a valid email address." },
      { status: 400 }
    );
  }

  if (message.length < 5) {
    return NextResponse.json(
      { ok: false, message: "Please add a short message before sending." },
      { status: 400 }
    );
  }

  const firstName = name.trim().split(/\s+/)[0] || "there";

  const supportSent = await sendEmail({
    to: "support@lessonforge.app",
    subject: `LessonForge Bug Report / Feedback from ${name}`,
    html: supportEmail({ name, email, message, userId, plan, timestamp }),
  });

  const confirmationSent = await sendEmail({
    to: email,
    subject: "We received your message — LessonForge",
    html: confirmationEmail(firstName),
  });

  const notificationSent = await sendEmail({
    to: "support@lessonforge.app",
    subject: `New feedback from ${name} — LessonForge`,
    html: notificationEmail({ name, email, message, plan, timestamp }),
  });

  if (!supportSent || !confirmationSent || !notificationSent) {
    return NextResponse.json(
      {
        ok: false,
        message: "We could not send your message right now. Please try again in a moment.",
      },
      { status: 200 }
    );
  }

  return NextResponse.json({
    ok: true,
    message: "Your message has been sent successfully.",
  });
}
