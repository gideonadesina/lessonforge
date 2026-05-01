import { createAdminClient } from "@/lib/supabase/admin";
import { sendEmail } from "@/lib/emails/send";
import { firstLessonReadyEmail } from "@/lib/emails/templates";

function appUrl(path: string) {
  const base =
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.NEXT_PUBLIC_SITE_URL ||
    "https://lessonforge.app";
  return `${base.replace(/\/$/, "")}${path}`;
}

function firstNameFrom(name: unknown, email: unknown) {
  const fullName = String(name ?? "").trim();
  if (fullName) return fullName.split(/\s+/)[0] || "there";
  const local = String(email ?? "").split("@")[0] || "";
  return local ? local.split(/[._-]/)[0] || "there" : "there";
}

export async function sendFirstGenerationEmailOnce({
  userId,
  lessonId,
}: {
  userId: string;
  lessonId: string;
}) {
  const admin = createAdminClient();

  const { count, error: countError } = await admin
    .from("lessons")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("type", "lesson");

  if (countError || Number(count ?? 0) !== 1) return;

  const { data: profile } = await admin
    .from("profiles")
    .select("full_name, email")
    .eq("id", userId)
    .maybeSingle();

  let email = String((profile as any)?.email ?? "").trim();
  let fullName = String((profile as any)?.full_name ?? "").trim();

  if (!email) {
    const { data: authUser } = await admin.auth.admin.getUserById(userId);
    email = String(authUser.user?.email ?? "").trim();
    fullName =
      fullName ||
      String(
        (authUser.user?.user_metadata as Record<string, unknown> | undefined)?.full_name ??
          (authUser.user?.user_metadata as Record<string, unknown> | undefined)?.name ??
          ""
      ).trim();
  }

  if (!email || !email.includes("@")) return;

  const { error: logError } = await admin.from("first_generation_email_logs").insert({
    user_id: userId,
    lesson_id: lessonId,
    email,
    status: "pending",
  });

  if (logError) {
    if (logError.code !== "23505") {
      console.error("[first-generation-email] log insert failed:", logError.message);
    }
    return;
  }

  const firstName = firstNameFrom(fullName, email);
  const lessonUrl = appUrl(`/lesson/${lessonId}`);
  const sent = await sendEmail({
    to: email,
    subject: `Your lesson is ready, ${firstName} `,
    html: firstLessonReadyEmail({ firstName, lessonUrl }),
    replyTo: "support@lessonforge.app",
  });

  await admin
    .from("first_generation_email_logs")
    .update({
      status: sent ? "sent" : "failed",
      sent_at: sent ? new Date().toISOString() : null,
      error: sent ? null : "Email provider returned failure.",
    })
    .eq("user_id", userId);
}
