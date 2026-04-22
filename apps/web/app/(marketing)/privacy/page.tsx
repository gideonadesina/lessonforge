import type { ReactNode } from "react";

export default function PrivacyPage() {
  return (
    <main
      style={{
        minHeight: "100vh",
        background: "#FAF9F6",
        fontFamily: "'Trebuchet MS', sans-serif",
        padding: "60px 20px",
      }}
    >
      <div style={{ maxWidth: "760px", margin: "0 auto" }}>
        <header style={{ marginBottom: "48px" }}>
          <a
            href="/"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "10px",
              textDecoration: "none",
              marginBottom: "32px",
            }}
          >
            <div
              style={{
                width: "36px",
                height: "36px",
                borderRadius: "10px",
                background: "linear-gradient(135deg, #534AB7, #3D35A0)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: "18px",
              }}
            >
              🎓
            </div>
            <span
              style={{
                fontFamily: "Georgia, serif",
                fontWeight: 700,
                fontSize: "18px",
                color: "#1E1B4B",
              }}
            >
              LessonForge
            </span>
          </a>

          <h1
            style={{
              fontFamily: "Georgia, 'Times New Roman', serif",
              fontSize: "36px",
              fontWeight: 700,
              color: "#1E1B4B",
              margin: 0,
              marginBottom: "8px",
            }}
          >
            Privacy Policy
          </h1>

          <p
            style={{
              margin: 0,
              fontSize: "14px",
              color: "#64748B",
            }}
          >
            Last updated: April 22, 2026
          </p>
        </header>

        <div
          style={{
            color: "#334155",
            fontSize: "15px",
            lineHeight: 1.8,
          }}
        >
          <Section title="1. Introduction">
            LessonForge respects your privacy. This Privacy Policy explains how we collect,
            use, store, and protect your information when you use our platform. By using
            LessonForge, you agree to the practices described in this policy.
          </Section>

          <Section title="2. Information We Collect">
            <ul style={{ paddingLeft: "24px", margin: 0 }}>
              <li style={{ marginBottom: "8px" }}>
                Personal information such as your name, email address, and school details
                when you create an account
              </li>
              <li style={{ marginBottom: "8px" }}>
                Account and usage data such as login activity, generated lessons,
                worksheets, exams, and planning activity
              </li>
              <li style={{ marginBottom: "8px" }}>
                Payment-related information processed securely through third-party payment
                providers such as Paystack
              </li>
              <li style={{ marginBottom: "8px" }}>
                Technical information such as browser type, device information, IP address,
                and pages visited for performance and security purposes
              </li>
            </ul>
          </Section>

          <Section title="3. How We Use Your Information">
            <ul style={{ paddingLeft: "24px", margin: 0 }}>
              <li style={{ marginBottom: "8px" }}>
                To create and manage your LessonForge account
              </li>
              <li style={{ marginBottom: "8px" }}>
                To generate lesson plans, notes, slides, worksheets, exams, and other
                teaching resources for you
              </li>
              <li style={{ marginBottom: "8px" }}>
                To process payments, manage credits, and provide support for billing issues
              </li>
              <li style={{ marginBottom: "8px" }}>
                To improve product quality, performance, reliability, and user experience
              </li>
              <li style={{ marginBottom: "8px" }}>
                To communicate important updates, service notices, and support responses
              </li>
              <li style={{ marginBottom: "8px" }}>
                To detect abuse, fraud, and unauthorized access
              </li>
            </ul>
          </Section>

          <Section title="4. AI-Generated Content and User Inputs">
            LessonForge uses artificial intelligence to help generate educational content.
            Information you enter into lesson generation forms may be processed to produce
            outputs such as lesson notes, quizzes, slides, and worksheets. You should avoid
            entering sensitive personal student data into prompts or text fields.
          </Section>

          <Section title="5. Sharing of Information">
            <>
              We do not sell your personal information. We may share limited information only
              in these situations:
              <ul style={{ paddingLeft: "24px", marginTop: "12px", marginBottom: 0 }}>
                <li style={{ marginBottom: "8px" }}>
                  With trusted service providers who help us operate the platform, such as
                  hosting, authentication, AI, analytics, and payment providers
                </li>
                <li style={{ marginBottom: "8px" }}>
                  When required by law, legal process, or lawful government request
                </li>
                <li style={{ marginBottom: "8px" }}>
                  To protect the rights, security, and integrity of LessonForge, our users,
                  and the public
                </li>
              </ul>
            </>
          </Section>

          <Section title="6. Cookies and Similar Technologies">
            LessonForge may use cookies and similar technologies to keep you signed in,
            remember preferences, improve performance, and understand how the platform is
            being used. You can manage cookies through your browser settings, though some
            features may not work properly if cookies are disabled.
          </Section>

          <Section title="7. Data Storage and Security">
            We take reasonable technical and organizational steps to protect your data
            against unauthorized access, loss, misuse, or disclosure. However, no digital
            system is completely secure, and we cannot guarantee absolute security.
          </Section>

          <Section title="8. Data Retention">
            We keep your information for as long as it is needed to provide the service,
            comply with legal obligations, resolve disputes, and enforce our agreements. If
            you delete your account, some information may remain in backups or records for a
            limited period where legally or operationally necessary.
          </Section>

          <Section title="9. Your Rights">
            Depending on applicable law, you may have the right to:
            <ul style={{ paddingLeft: "24px", marginTop: "12px", marginBottom: 0 }}>
              <li style={{ marginBottom: "8px" }}>Access the personal data we hold about you</li>
              <li style={{ marginBottom: "8px" }}>Request correction of inaccurate information</li>
              <li style={{ marginBottom: "8px" }}>Request deletion of your account or data</li>
              <li style={{ marginBottom: "8px" }}>
                Object to or restrict certain uses of your information
              </li>
            </ul>
          </Section>

          <Section title="10. Children’s Privacy">
            LessonForge is intended for teachers, school administrators, and adult users. We
            do not knowingly collect personal information directly from children without
            proper authorization or lawful basis.
          </Section>

          <Section title="11. Changes to This Policy">
            We may update this Privacy Policy from time to time. When we make significant
            changes, we will update the effective date and may notify users through the
            platform or by email where appropriate.
          </Section>

          <Section title="12. Contact Us">
            <>
              If you have questions about this Privacy Policy, contact us at{" "}
              <a href="mailto:adesinagideon113@gmail.com" style={{ color: "#534AB7" }}>
                adesinagideon113@gmail.com
              </a>
              .
            </>
          </Section>
        </div>

        <footer
          style={{
            marginTop: "48px",
            paddingTop: "24px",
            borderTop: "1px solid #E2E8F0",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            flexWrap: "wrap",
            gap: "12px",
          }}
        >
          <a
            href="/"
            style={{
              color: "#534AB7",
              fontSize: "14px",
              fontWeight: 600,
              textDecoration: "none",
            }}
          >
            ← Back to LessonForge
          </a>

          <a
            href="/terms"
            style={{
              color: "#64748B",
              fontSize: "14px",
              textDecoration: "none",
            }}
          >
            Terms of Service →
          </a>
        </footer>
      </div>
    </main>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <section style={{ marginBottom: "36px" }}>
      <h2
        style={{
          fontFamily: "Georgia, 'Times New Roman', serif",
          fontSize: "18px",
          fontWeight: 700,
          color: "#1E1B4B",
          margin: 0,
          marginBottom: "12px",
        }}
      >
        {title}
      </h2>

      <div style={{ color: "#334155", lineHeight: 1.8 }}>{children}</div>
    </section>
  );
}