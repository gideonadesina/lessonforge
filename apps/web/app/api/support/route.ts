import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { ROLE_COOKIE_KEY } from "@/lib/auth/roles";
import { sendEmail } from "@/lib/emails/send";
import { supportRequestEmail } from "@/lib/emails/templates";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

const ISSUE_TYPES = new Set([
  "General question",
  "Lesson generation issue",
  "Payment/billing issue",
  "School workspace issue",
  "Bug report",
  "Feature request",
]);

type SupportBody = {
  name?: unknown;
  email?: unknown;
  issueType?: unknown;
  message?: unknown;
  metadata?: {
    userId?: unknown;
    userEmail?: unknown;
    activeRole?: unknown;
    pagePath?: unknown;
    timestamp?: unknown;
  };
};

function clean(value: unknown, max = 500) {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
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

export async function POST(req: NextRequest) {
  let body: SupportBody;
  try {
    body = (await req.json()) as SupportBody;
  } catch {
    return NextResponse.json(
      { ok: false, message: "Please complete the support form and try again." },
      { status: 400 }
    );
  }

  const user = await readUser(req);
  const metadata = body.metadata ?? {};
  const issueType = clean(body.issueType, 80);
  const senderEmail = clean(body.email, 180) || user?.email || clean(metadata.userEmail, 180);
  const senderName =
    clean(body.name, 120) ||
    clean(user?.user_metadata?.full_name, 120) ||
    clean(user?.user_metadata?.name, 120) ||
    senderEmail.split("@")[0] ||
    "LessonForge user";
  const message = clean(body.message, 5000);
  const userId = user?.id || clean(metadata.userId, 120);
  const activeRole =
    clean(metadata.activeRole, 80) ||
    clean(req.cookies.get(ROLE_COOKIE_KEY)?.value, 80);
  const pagePath = clean(metadata.pagePath, 500);
  const timestamp = clean(metadata.timestamp, 80) || new Date().toISOString();

  if (!ISSUE_TYPES.has(issueType)) {
    return NextResponse.json(
      { ok: false, message: "Please choose a valid issue type." },
      { status: 400 }
    );
  }

  if (!senderEmail || !isEmail(senderEmail)) {
    return NextResponse.json(
      { ok: false, message: "Please enter a valid email address." },
      { status: 400 }
    );
  }

  if (message.length < 10) {
    return NextResponse.json(
      { ok: false, message: "Please add a short description of the issue." },
      { status: 400 }
    );
  }

  try {
    const sent = await sendEmail({
      to: "support@lessonforge.app",
      subject: `[LessonForge Support] ${issueType} from ${senderEmail}`,
      html: supportRequestEmail({
        issueType,
        senderName,
        senderEmail,
        message,
        userId,
        activeRole,
        pagePath,
        timestamp,
      }),
    });
    if (!sent) {
      return NextResponse.json(
        {
          ok: false,
          message: "We could not send your message right now. Please try again in a moment.",
        },
        { status: 200 }
      );
    }
  } catch (error) {
    console.error("[support] Email send failed:", error);
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
    message: "Thanks. Your message has been sent to LessonForge support.",
  });
}
