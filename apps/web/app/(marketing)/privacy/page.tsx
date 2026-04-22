export default function PrivacyPage() {
  return (
    <div style={{
      minHeight: "100vh",
      background: "#FAF9F6",
      fontFamily: "'Trebuchet MS', sans-serif",
      padding: "60px 20px",
    }}>
      <div style={{ maxWidth: "760px", margin: "0 auto" }}>

        {/* Header */}
        <div style={{ marginBottom: "48px" }}>
          <a href="/" style={{
            display: "inline-flex", alignItems: "center", gap: "10px",
            textDecoration: "none", marginBottom: "32px",
          }}>
            <div style={{
              width: "36px", height: "36px", borderRadius: "10px",
              background: "linear-gradient(135deg, #534AB7, #3D35A0)",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: "18px",
            }}>🎓</div>
            <span style={{
              fontFamily: "Georgia, serif", fontWeight: "700",
              fontSize: "18px", color: "#1E1B4B",
            }}>LessonForge</span>
          </a>

          <h1 style={{
            fontFamily: "Georgia, 'Times New Roman', serif",
            fontSize: "36px", fontWeight: "700",
            color: "#1E1B4B", marginBottom: "8px",
          }}>Privacy Policy</h1>
          <p style={{ fontSize: "14px", color: "#64748B" }}>
            Last updated: April 22, 2026
          </p>
        </div>

        <div style={{ color: "#334155", lineHeight: "1.8", fontSize: "15px" }}>

          <Section title="1. Introduction">
            LessonForge ("we", "our", or "us") is an AI-powered school workspace built for
            teachers and school administrators in Nigeria and beyond. We are committed to
            protecting your personal information and being transparent about how we use it.
            This Privacy Policy explains what data we collect, how we use it, and your rights
            regarding that data.
          </Section>

          <Section title="2. Who We Are">
            LessonForge is operated from Nigeria. If you have any questions about this policy
            or your data, you can contact us at:{" "}
            <a href="mailto:adesinagideon113@gmail.com" style={{ color: "#534AB7" }}>
              adesinagideon113@gmail.com
            </a>
          </Section>

          <Section title="3. What Data We Collect">
            We collect the minimum data needed to provide our service:
            <ul style={{ marginTop: "12px", paddingLeft: "24px" }}>
              <li style={{ marginBottom: "8px" }}>
                <strong>Account information:</strong> Your full name and email address,
                provided when you sign up or sign in with Google.
              </li>
              <li style={{ marginBottom: "8px" }}>
                <strong>Content you generate:</strong> Lesson plans, worksheets, slide decks,
                exams, and other educational content you create using LessonForge.
              </li>
              <li style={{ marginBottom: "8px" }}>
                <strong>Payment information:</strong> When you purchase a plan, payments are
                processed securely by Paystack. We do not store your card details.
                We only store a record of your plan, payment status, and transaction reference.
              </li>
              <li style={{ marginBottom: "8px" }}>
                <strong>Usage data:</strong> Basic information about how you use the platform,
                such as which features you use and how often, to help us improve the product.
              </li>
            </ul>
          </Section>

          <Section title="4. How We Use Your Data">
            We use your data to:
            <ul style={{ marginTop: "12px", paddingLeft: "24px" }}>
              <li style={{ marginBottom: "8px" }}>Provide and maintain your LessonForge account</li>
              <li style={{ marginBottom: "8px" }}>Generate and save your lesson content</li>
              <li style={{ marginBottom: "8px" }}>Process payments and manage your subscription</li>
              <li style={{ marginBottom: "8px" }}>Send important account and service notifications</li>
              <li style={{ marginBottom: "8px" }}>Improve and develop our product features</li>
              <li style={{ marginBottom: "8px" }}>Respond to your support requests</li>
            </ul>
            We do not sell your personal data to any third party. We do not use your data
            for advertising purposes.
          </Section>

          <Section title="5. Data Storage and Security">
            Your data is stored securely using Supabase, a trusted cloud database provider.
            All data is encrypted in transit using HTTPS. We take reasonable technical and
            organisational measures to protect your information from unauthorised access,
            loss, or misuse.
          </Section>

          <Section title="6. Third-Party Services">
            We use the following trusted third-party services to operate LessonForge:
            <ul style={{ marginTop: "12px", paddingLeft: "24px" }}>
              <li style={{ marginBottom: "8px" }}>
                <strong>Supabase</strong> — database and authentication
              </li>
              <li style={{ marginBottom: "8px" }}>
                <strong>Google OAuth</strong> — sign-in with Google
              </li>
              <li style={{ marginBottom: "8px" }}>
                <strong>OpenAI</strong> — AI content generation
              </li>
              <li style={{ marginBottom: "8px" }}>
                <strong>Paystack</strong> — payment processing
              </li>
            </ul>
            Each of these services has their own privacy policy governing how they handle data.
          </Section>

          <Section title="7. Your Rights">
            You have the right to:
            <ul style={{ marginTop: "12px", paddingLeft: "24px" }}>
              <li style={{ marginBottom: "8px" }}>Access the personal data we hold about you</li>
              <li style={{ marginBottom: "8px" }}>Request correction of inaccurate data</li>
              <li style={{ marginBottom: "8px" }}>Request deletion of your account and data</li>
              <li style={{ marginBottom: "8px" }}>Export your generated lesson content</li>
            </ul>
            To exercise any of these rights, email us at{" "}
            <a href="mailto:adesinagideon113@gmail.com" style={{ color: "#534AB7" }}>
              adesinagideon113@gmail.com
            </a>{" "}
            and we will respond within 7 business days.
          </Section>

          <Section title="8. Data Retention">
            We retain your account data for as long as your account is active. If you delete
            your account, we will delete your personal data within 30 days, except where we
            are required to retain it for legal or financial compliance purposes.
          </Section>

          <Section title="9. Children's Privacy">
            LessonForge is designed for use by teachers and school administrators. It is not
            intended for use by children under the age of 13. We do not knowingly collect
            personal data from children.
          </Section>

          <Section title="10. Changes to This Policy">
            We may update this Privacy Policy from time to time. When we do, we will update
            the "Last updated" date at the top of this page and notify active users by email
            if the changes are significant.
          </Section>

          <Section title="11. Contact Us">
            If you have any questions or concerns about this Privacy Policy or how we handle
            your data, please contact us at:{" "}
            <a href="mailto:adesinagideon113@gmail.com" style={{ color: "#534AB7" }}>
              adesinagideon113@gmail.com
            </a>
          </Section>

        </div>

        <div style={{
          marginTop: "48px", paddingTop: "24px",
          borderTop: "1px solid #E2E8F0",
          display: "flex", justifyContent: "space-between",
          alignItems: "center", flexWrap: "wrap", gap: "12px",
        }}>
          <a href="/" style={{ color: "#534AB7", fontSize: "14px", textDecoration: "none", fontWeight: "600" }}>
            ← Back to LessonForge
          </a>
          <a href="/terms" style={{ color: "#64748B", fontSize: "14px", textDecoration: "none" }}>
            Terms of Service →
          </a>
        </div>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: "36px" }}>
      <h2 style={{
        fontFamily: "Georgia, 'Times New Roman', serif",
        fontSize: "18px", fontWeight: "700",
        color: "#1E1B4B", marginBottom: "12px",
      }}>{title}</h2>
      <div style={{ color: "#334155", lineHeight: "1.8" }}>{children}</div>
    </div>
  );
}