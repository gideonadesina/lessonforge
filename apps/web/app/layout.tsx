import "./globals.css";
import Script from "next/script";
import type { Metadata, Viewport } from "next";
import { ToastProvider } from "@/components/ui/ToastProvider";
import { NetworkProvider } from "@/components/network/NetworkProvider";
import ThemeInitializer from "@/components/theme/ThemeInitializer";

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
    icon: "/favicon.png",
  },

  openGraph: {
    title: "LessonForge – AI Lesson Plan Generator for Teachers",
    description:
      "Generate complete lesson packs: notes, slides, quizzes, and activities. Built for WAEC, NECO, Cambridge & Nigeria-friendly teaching.",
    url: "https://lessonforge.app",
    siteName: "LessonForge",
    type: "website",
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
  const GA_ID = process.env.NEXT_PUBLIC_GA_ID;

  return (
    <html lang="en">
      <body className="min-h-screen antialiased">
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

        <ThemeInitializer />

        <ToastProvider>
          <NetworkProvider>
            {children}
          </NetworkProvider>
        </ToastProvider>
      </body>
    </html>
  );
}