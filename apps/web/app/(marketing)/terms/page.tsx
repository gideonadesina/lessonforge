import type { ReactNode } from "react";

export default function TermsPage() {
  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#FAF9F6",
        fontFamily: "'Trebuchet MS', sans-serif",
        padding: "60px 20px",
      }}
    >
      <div style={{ maxWidth: "760px", margin: "0 auto" }}>
        <div style={{ marginBottom: "48px" }}>
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
                fontWeight: "700",
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
              fontWeight: "700",
              color: "#1E1B4B",
              marginBottom: "8px",
            }}
          >
            Terms of Service
          </h1>
          <p style={{ fontSize: "14px", color: "#64748B" }}>
            Last updated: April 22, 2026
          </p>
        </div>

        <div style={{ color: "#334155", lineHeight: "1.8", fontSize: "15px" }}>
          <Section title="1. Acceptance of Terms">
            By creating an account on LessonForge, you agree to be bound by these Terms of
            Service. If you do not agree to these terms, please do not use the platform.
            These terms apply to all users including teachers, heads of department, and
            school principals.
          </Section>

          <Section title="2. What LessonForge Provides">
            LessonForge is an AI-powered school workspace that helps educators generate
            lesson plans, worksheets, slide decks, exams, and other classroom resources.
            We provide these tools to save teachers time and improve the quality of
            educational content in Nigerian and international schools.
          </Section>

          <Section title="3. Your Account">
            <ul style={{ paddingLeft: "24px" }}>
              <li style={{ marginBottom: "8px" }}>
                You must provide accurate information when creating your account.
              </li>
              <li style={{ marginBottom: "8px" }}>
                You are responsible for keeping your login credentials secure.
              </li>
              <li style={{ marginBottom: "8px" }}>
                You must be at least 18 years old to create an account.
              </li>
              <li style={{ marginBottom: "8px" }}>
                One person may not create multiple accounts to exploit free credits.
              </li>
              <li style={{ marginBottom: "8px" }}>
                We reserve the right to suspend accounts that violate these terms.
              </li>
            </ul>
          </Section>

          <Section title="4. Credits and Payments">
            <ul style={{ paddingLeft: "24px" }}>
              <li style={{ marginBottom: "8px" }}>
                New users receive 8 free credits upon registration to explore the platform.
              </li>
              <li style={{ marginBottom: "8px" }}>
                Credits are consumed when you generate content. Different content types
                cost different amounts of credits.
              </li>
              <li style={{ marginBottom: "8px" }}>
                Paid plans are available to purchase additional credits. All prices are
                listed in Nigerian Naira (₦).
              </li>
              <li style={{ marginBottom: "8px" }}>
                Payments are processed securely by Paystack. By making a payment you
                agree to Paystack&apos;s terms of service.
              </li>
              <li style={{ marginBottom: "8px" }}>
                Credits are non-transferable and cannot be exchanged for cash.
              </li>
              <li style={{ marginBottom: "8px" }}>
                We do not offer refunds on purchased credits once they have been used.
                If you experience a technical error that incorrectly deducted credits,
                contact us and we will investigate and restore them where appropriate.
              </li>
            </ul>
          </Section>

          <Section title="5. Content You Generate">
            <ul style={{ paddingLeft: "24px" }}>
              <li style={{ marginBottom: "8px" }}>
                The lesson plans, worksheets, and other content you generate on LessonForge
                belong to you. You may use them freely in your classroom and school.
              </li>
              <li style={{ marginBottom: "8px" }}>
                You may not resell or commercially redistribute AI-generated content from
                LessonForge as your own original product.
              </li>
              <li style={{ marginBottom: "8px" }}>
                You are responsible for reviewing generated content for accuracy before
                using it in a classroom setting. AI can make mistakes.
              </li>
              <li style={{ marginBottom: "8px" }}>
                Do not enter sensitive student information names, addresses, or personal
                details into any generation form.
              </li>
            </ul>
          </Section>

          <Section title="6. Acceptable Use">
            <>
              You agree not to use LessonForge to:
              <ul style={{ marginTop: "12px", paddingLeft: "24px" }}>
                <li style={{ marginBottom: "8px" }}>
                  Generate harmful, abusive, or inappropriate content
                </li>
                <li style={{ marginBottom: "8px" }}>
                  Violate any applicable Nigerian or international laws
                </li>
                <li style={{ marginBottom: "8px" }}>
                  Attempt to reverse engineer, copy, or replicate the platform
                </li>
                <li style={{ marginBottom: "8px" }}>
                  Use automated tools to abuse the credit system
                </li>
                <li style={{ marginBottom: "8px" }}>
                  Share your account credentials with others
                </li>
              </ul>
            </>
          </Section>

          <Section title="7. Service Availability">
            We aim to keep LessonForge available at all times but we do not guarantee
            uninterrupted access. We may occasionally perform maintenance, updates, or
            experience outages beyond our control. We are not liable for any losses caused
            by temporary unavailability of the service.
          </Section>

          <Section title="8. Limitation of Liability">
            LessonForge provides AI-generated content as a tool to assist educators. We are
            not responsible for any errors in generated content or for decisions made based
            on that content. To the maximum extent permitted by Nigerian law, our total
            liability to you for any claim arising from your use of LessonForge shall not
            exceed the amount you paid us in the 3 months preceding the claim.
          </Section>

          <Section title="9. Changes to the Service">
            We reserve the right to modify, update, or discontinue features of LessonForge
            at any time. We will give reasonable notice of significant changes. Continued
            use of the platform after changes constitutes acceptance of the updated terms.
          </Section>

          <Section title="10. Governing Law">
            These Terms of Service are governed by the laws of the Federal Republic of
            Nigeria. Any disputes arising from your use of LessonForge shall be subject
            to the jurisdiction of Nigerian courts.
          </Section>

          <Section title="11. Contact">
            <>
              If you have any questions about these Terms of Service, please contact us at:{" "}
              <a href="mailto:adesinagideon113@gmail.com" style={{ color: "#534AB7" }}>
                adesinagideon113@gmail.com
              </a>
            </>
          </Section>
        </div>

        <div
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
              textDecoration: "none",
              fontWeight: "600",
            }}
          >
            ← Back to LessonForge
          </a>
          <a
            href="/privacy"
            style={{
              color: "#64748B",
              fontSize: "14px",
              textDecoration: "none",
            }}
          >
            Privacy Policy →
          </a>
        </div>
      </div>
    </div>
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
    <div style={{ marginBottom: "36px" }}>
      <h2
        style={{
          fontFamily: "Georgia, 'Times New Roman', serif",
          fontSize: "18px",
          fontWeight: "700",
          color: "#1E1B4B",
          marginBottom: "12px",
        }}
      >
        {title}
      </h2>
      <div style={{ color: "#334155", lineHeight: "1.8" }}>{children}</div>
    </div>
  );
}