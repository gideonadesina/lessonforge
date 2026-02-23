import "./globals.css";
import Script from "next/script";
import type { Metadata, Viewport } from "next";

export const metadata: Metadata = {
  metadataBase: new URL("https://lessonforge.app"),

  title: {
    default: "LessonForge – AI Lesson Plan Generator for Teachers",
    template: "%s | LessonForge",
  },

  description:
    "Generate complete lesson packs: objectives, lesson notes, slides, quizzes, and classroom activities. Built for WAEC, NECO, Cambridge & Nigeria-friendly teaching.",

  applicationName: "LessonForge",

  keywords: [
    "lesson plan generator",
    "AI lesson planner",
    "lesson notes generator",
    "teacher lesson plan software",
    "WAEC lesson plan",
    "NECO lesson plan",
    "Cambridge lesson plan",
    "Nigeria teachers",
  ],

  icons: {
    icon: "/favicon.png", // ✅ favicon from public folder
  },

  openGraph: {
    title: "LessonForge – AI Lesson Plan Generator for Teachers",
    description:
      "Generate complete lesson packs: notes, slides, quizzes, and activities. Built for WAEC, NECO, Cambridge & Nigeria-friendly teaching.",
    url: "https://lessonforge.app",
    siteName: "LessonForge",
    type: "website",
    // If you don't have /public/og.png yet, comment this images block out for now.
    images: [
      {
        url: "/og.png",
        width: 1200,
        height: 630,
        alt: "LessonForge",
      },
    ],
  },

  twitter: {
    card: "summary_large_image",
    title: "LessonForge – AI Lesson Plan Generator for Teachers",
    description:
      "Generate lesson notes, slides, quizzes, and classroom activities in seconds.",
    // If you don't have /public/og.png yet, comment this images line out for now.
    images: ["/og.png"],
  },

  alternates: {
    canonical: "https://lessonforge.app",
  },
};

export const viewport: Viewport = { width: "device-width", initialScale: 1 };

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const GA_ID = process.env.NEXT_PUBLIC_GA_ID; // add in .env

  return (
    <html lang="en">
      <body className="antialiased min-h-screen bg-slate-50">
        {/* ✅ Google Analytics */}
        {GA_ID && (
          <>
            <Script
              src={`https://www.googletagmanager.com/gtag/js?id=${GA_ID}`}
              strategy="afterInteractive"
            />
            <Script id="google-analytics" strategy="afterInteractive">
              {`
                window.dataLayer = window.dataLayer || [];
                function gtag(){dataLayer.push(arguments);}
                gtag('js', new Date());
                gtag('config', '${GA_ID}');
              `}
            </Script>
          </>
        )}

        {children}
      </body>
    </html>
  );
 }