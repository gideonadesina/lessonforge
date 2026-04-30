function esc(value: unknown) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

const base = (content: string) => `
<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width"/>
<style>
  body{margin:0;padding:0;background:#f4f4f8;
    font-family:'Helvetica Neue',Arial,sans-serif}
  .wrap{max-width:520px;margin:32px auto;
    background:#fff;border-radius:12px;
    overflow:hidden;border:1px solid #e5e7eb}
  .hdr{background:#6C63FF;padding:20px 32px;
    display:flex;align-items:center;gap:10px}
  .logo-text{color:#fff;font-size:18px;
    font-weight:800;letter-spacing:-0.5px}
  .body{padding:28px 32px}
  p{font-size:15px;color:#1a1a2e;
    line-height:1.7;margin:0 0 14px}
  p.muted{font-size:13px;color:#6b7280}
  table.info{width:100%;border-collapse:collapse;
    margin:16px 0}
  table.info td{padding:10px 0;font-size:14px;
    border-bottom:1px solid #f3f4f6}
  table.info td.label{color:#6b7280;width:45%}
  table.info td.value{font-weight:700;
    color:#1a1a2e;text-align:right}
  .btn{display:block;background:#6C63FF;
    color:#fff;text-align:center;
    padding:14px 24px;border-radius:8px;
    font-size:15px;font-weight:700;
    text-decoration:none;margin:20px 0}
  .tip{background:#fffbeb;
    border-left:3px solid #f59e0b;
    border-radius:0 8px 8px 0;
    padding:12px 16px;margin:16px 0}
  .tip p{font-size:13px;color:#92400e;margin:0}
  .alert{background:#fff7ed;
    border-left:3px solid #f59e0b;
    border-radius:0 8px 8px 0;
    padding:14px 16px;margin:16px 0}
  .alert p{font-size:14px;color:#92400e;margin:0}
  .danger{background:#fff0f0;
    border-left:3px solid #ef4444;
    border-radius:0 8px 8px 0;
    padding:14px 16px;margin:16px 0}
  .danger p{font-size:14px;color:#dc2626;margin:0}
  .code-box{background:#f3f0ff;
    border:1.5px dashed #6C63FF;
    border-radius:10px;padding:18px;
    text-align:center;margin:16px 0}
  .code{font-size:28px;font-weight:800;
    color:#6C63FF;letter-spacing:4px}
  hr{border:none;border-top:0.5px solid #f3f4f6;
    margin:20px 0}
  .sig{font-size:14px;color:#6b7280;line-height:1.8}
  .sig strong{color:#1a1a2e}
  .ftr{padding:14px 32px;background:#f9f9fb;
    border-top:0.5px solid #e5e7eb;text-align:center}
  .ftr p{font-size:12px;color:#9ca3af;margin:3px 0}
</style>
</head>
<body>
<div class="wrap">
  <div class="hdr">
    <svg width="28" height="28" viewBox="0 0 32 32">
      <rect width="32" height="32" rx="7" fill="white"/>
      <path d="M8,21 L15.5,18 L15.5,11 L8,14 Z"
        fill="#6C63FF"/>
      <path d="M15.5,18 L23,21 L23,14 L15.5,11 Z"
        fill="#6C63FF" opacity="0.6"/>
      <line x1="15.5" y1="10.5" x2="15.5" y2="21.5"
        stroke="white" stroke-width="1.2"/>
      <path d="M16,10 L17,7 L18,10 L21,11 L18,12
        L17,15 L16,12 L13,11 Z" fill="#6C63FF"/>
    </svg>
    <span class="logo-text">LessonForge</span>
  </div>
  <div class="body">${content}</div>
  <div class="ftr">
    <p>LessonForge · lessonforge.app</p>
    <p>support@lessonforge.app</p>
  </div>
</div>
</body>
</html>`;

export function welcomeEmail({ firstName }: { firstName: string }) {
  return base(`
<p>Hi ${firstName},</p>
<p>Welcome — you just joined teachers across Africa
who are saving hours every week with LessonForge.</p>
<p>Here is what you can do right now:</p>
<table class="info">
  <tr><td class="label">Lesson plans</td>
    <td class="value">Generated in 30 seconds</td></tr>
  <tr><td class="label">Teaching notes</td>
    <td class="value">Detailed, ready for class</td></tr>
  <tr><td class="label">Slides</td>
    <td class="value">Created automatically</td></tr>
  <tr><td class="label">Quiz + exam questions</td>
    <td class="value">With answers included</td></tr>
</table>
<p>You have <strong>8 free credits</strong> to get
started. No payment needed.</p>
<a class="btn"
  href="https://lessonforge.app/generate">
  Generate Your First Lesson
</a>
<hr/>
<p>If you run into anything or have questions,
just reply to this email — we are here.</p>
<div class="sig">
  — <strong>LessonForge</strong><br/>
  Built for African classrooms<br/>
  support@lessonforge.app
</div>`);
}

export function paymentConfirmedEmail({
  firstName,
  planName,
  creditsAdded,
  amountPaid,
  newBalance,
  paymentReference,
  paidAt,
}: {
  firstName: string;
  planName: string;
  creditsAdded: number;
  amountPaid: string;
  newBalance: number;
  paymentReference?: string | null;
  paidAt?: string | null;
}) {
  const date = paidAt || new Date().toISOString();
  return base(`
<p>Hi ${firstName},</p>
<p><strong>Payment confirmed.</strong> Your credits are live
and ready to use. Keep this receipt for your records.</p>
<table class="info">
  <tr><td class="label">Plan</td>
    <td class="value">${planName}</td></tr>
  <tr><td class="label">Amount paid</td>
    <td class="value">${amountPaid}</td></tr>
  <tr><td class="label">Credits added</td>
    <td class="value">${creditsAdded}</td></tr>
  <tr><td class="label">New balance</td>
    <td class="value">${newBalance} credits</td></tr>
  <tr><td class="label">Date</td>
    <td class="value">${esc(date)}</td></tr>
  <tr><td class="label">Reference</td>
    <td class="value">${esc(paymentReference || "Not provided")}</td></tr>
</table>
<a class="btn"
  href="https://lessonforge.app/generate">
  Start Generating
</a>
<hr/>
<p class="muted">Keep this email as your payment
receipt. If anything looks wrong, reply here and
we will sort it out immediately.</p>
<div class="sig">
  — <strong>LessonForge</strong><br/>
  Built for African classrooms<br/>
  support@lessonforge.app
</div>`);
}

export function schoolWorkspaceEmail({
  firstName,
  schoolName,
  schoolCode,
  planName,
  schoolCredits,
}: {
  firstName: string;
  schoolName?: string | null;
  schoolCode: string;
  planName: string;
  schoolCredits: number;
}) {
  return base(`
<p>Hi ${firstName},</p>
<p>Your school workspace is live. Share the code
below with your teachers so they can join and
start generating lessons from your school credit
pool.</p>
<div class="code-box">
  <div style="font-size:12px;color:#7C3AED;
    margin-bottom:8px;font-weight:600;
    letter-spacing:1px">TEACHER JOIN CODE</div>
  <div class="code">${schoolCode}</div>
  <p style="font-size:13px;color:#7C3AED;
    margin:8px 0 0">
    Share this code with every teacher
    in your school
  </p>
</div>
<table class="info">
  <tr><td class="label">School</td>
    <td class="value">${esc(schoolName || "Your school")}</td></tr>
  <tr><td class="label">Plan</td>
    <td class="value">${planName}</td></tr>
  <tr><td class="label">School credits</td>
    <td class="value">${schoolCredits}</td></tr>
  <tr><td class="label">Teachers</td>
    <td class="value">Unlimited</td></tr>
</table>
<p>Once a teacher enters this code during signup,
they join your school and generate lessons from
your credit pool. No individual payment needed.</p>
<a class="btn"
  href="https://lessonforge.app/principal/dashboard">
  Go to Principal Dashboard
</a>
<hr/>
<p class="muted">Questions about your school
workspace? Just reply here.</p>
<div class="sig">
  — <strong>LessonForge</strong><br/>
  Built for African classrooms<br/>
  support@lessonforge.app
</div>`);
}

export function creditsLowEmail({
  firstName,
  creditsLeft,
}: {
  firstName: string;
  creditsLeft: number;
}) {
  return base(`
<p>Hi ${firstName},</p>
<p>Just a heads up — you are down to
<strong>${creditsLeft} credits</strong>
on LessonForge.</p>
<div class="alert">
  <p>Top up before you run out so you are never
  caught without a lesson plan the night before
  class.</p>
</div>
<a class="btn"
  href="https://lessonforge.app/pricing">
  Top Up Credits
</a>
<hr/>
<p class="muted">Quick tip: Top up during the
weekend so you are fully loaded for the week
ahead.</p>
<div class="sig">
  — <strong>LessonForge</strong><br/>
  Built for African classrooms<br/>
  support@lessonforge.app
</div>`);
}

export function creditsFinishedEmail({ firstName }: { firstName: string }) {
  return base(`
<p>Hi ${firstName},</p>
<p>Your LessonForge credits have run out. You
will not be able to generate new lessons until
you top up.</p>
<div class="danger">
  <p>You currently have <strong>0 credits</strong>
  remaining. Top up now to continue generating
  lessons immediately.</p>
</div>
<a class="btn"
  href="https://lessonforge.app/pricing">
  Buy More Credits
</a>
<hr/>
<p class="muted">Already topped up and still
seeing this? Reply to this email and we will
check your account right away.</p>
<div class="sig">
  — <strong>LessonForge</strong><br/>
  Built for African classrooms<br/>
  support@lessonforge.app
</div>`);
}

export function supportRequestEmail({
  issueType,
  senderName,
  senderEmail,
  message,
  userId,
  activeRole,
  pagePath,
  timestamp,
}: {
  issueType: string;
  senderName: string;
  senderEmail: string;
  message: string;
  userId?: string | null;
  activeRole?: string | null;
  pagePath?: string | null;
  timestamp?: string | null;
}) {
  return base(`
<p><strong>New support request</strong></p>
<table class="info">
  <tr><td class="label">Issue type</td>
    <td class="value">${esc(issueType)}</td></tr>
  <tr><td class="label">Sender name</td>
    <td class="value">${esc(senderName || "Not provided")}</td></tr>
  <tr><td class="label">Sender email</td>
    <td class="value">${esc(senderEmail)}</td></tr>
  <tr><td class="label">User ID</td>
    <td class="value">${esc(userId || "Not available")}</td></tr>
  <tr><td class="label">Active role</td>
    <td class="value">${esc(activeRole || "Not available")}</td></tr>
  <tr><td class="label">Page path</td>
    <td class="value">${esc(pagePath || "Not available")}</td></tr>
  <tr><td class="label">Timestamp</td>
    <td class="value">${esc(timestamp || new Date().toISOString())}</td></tr>
</table>
<div class="tip">
  <p>${esc(message).replace(/\n/g, "<br/>")}</p>
</div>`);
}

export function productUpdateEmail({
  title,
  summary,
  ctaUrl,
  ctaText,
}: {
  title: string;
  summary: string;
  ctaUrl: string;
  ctaText: string;
}) {
  return base(`
<p><strong>${esc(title)}</strong></p>
<p>${esc(summary)}</p>
<a class="btn" href="${esc(ctaUrl)}">${esc(ctaText)}</a>
<hr/>
<p class="muted">You are receiving this because you use LessonForge.</p>`);
}
