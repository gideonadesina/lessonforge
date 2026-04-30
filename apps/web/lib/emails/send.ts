import { resend } from "./resend";

export async function sendEmail({
  to,
  subject,
  html,
  replyTo,
}: {
  to: string;
  subject: string;
  html: string;
  replyTo?: string;
}) {
  try {
    if (!process.env.RESEND_API_KEY) {
      console.warn("RESEND_API_KEY is missing. Email not sent.");
      return false;
    }

    await resend.emails.send({
      from: "LessonForge <support@lessonforge.app>",
      to,
      subject,
      html,
      ...(replyTo ? { replyTo } : {}),
    });
    return true;
  } catch (err) {
    console.error("Email send failed:", err);
    return false;
  }
}
