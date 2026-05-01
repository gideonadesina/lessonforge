import { NextResponse } from "next/server";
import { ADMIN_USER_ID, getAdminSessionUserId } from "@/lib/admin/metrics";
import { noGenerationNudgeEmail } from "@/lib/emails/templates";
import { sendEmail } from "@/lib/emails/send";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

function firstNameFrom(fullName: string | null | undefined, email: string | null | undefined) {
  const name = String(fullName ?? "").trim();
  if (name) return name.split(/\s+/)[0] || "there";
  const local = String(email ?? "").split("@")[0] || "";
  return local ? local.split(/[._-]/)[0] || "there" : "there";
}

export async function POST(request: Request) {
  const userId = await getAdminSessionUserId();
  if (!userId || userId !== ADMIN_USER_ID) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const input = (await request.json().catch(() => null)) as { userId?: string } | null;
  const targetUserId = String(input?.userId ?? "").trim();
  if (!targetUserId) {
    return NextResponse.json({ error: "User ID is required." }, { status: 400 });
  }

  const supabase = createAdminClient();
  const { data: profile, error } = await supabase
    .from("profiles")
    .select("id, full_name, email")
    .eq("id", targetUserId)
    .maybeSingle();

  if (error || !profile) {
    return NextResponse.json({ error: error?.message ?? "User not found." }, { status: 404 });
  }

  const email = String((profile as any).email ?? "").trim();
  if (!email || !email.includes("@")) {
    return NextResponse.json({ error: "This user does not have a valid email address." }, { status: 400 });
  }

  const firstName = firstNameFrom((profile as any).full_name, email);
  const sent = await sendEmail({
    to: email,
    subject: "Your first lesson is 60 seconds away ",
    html: noGenerationNudgeEmail({ firstName }),
    replyTo: "support@lessonforge.app",
  });

  if (!sent) {
    return NextResponse.json({ error: "Email could not be sent. Check RESEND_API_KEY and Resend logs." }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    email,
    firstName,
    message: `No Generation email sent to ${email}.`,
  });
}
