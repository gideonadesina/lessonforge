import "./globals.css";
import Script from "next/script";
import type { Metadata, Viewport } from "next";
import { ToastProvider } from "@/components/ui/ToastProvider";
import { NetworkProvider } from "@/components/network/NetworkProvider";
import ThemeInitializer from "@/components/theme/ThemeInitializer";

const defaultDescription =
  "LessonForge helps teachers across Africa generate complete lesson packs - lesson plans, lesson notes, slides, quizzes and exams - aligned to NERDC, WAEC, NECO, Cambridge and local curricula. Free to start.";

export const metadata: Metadata = {
  metadataBase: new URL("https://lessonforge.app"),

  title: {
    default: "LessonForge - AI Lesson Planning for African Teachers",
    template: "%s | LessonForge",
  },

  description: defaultDescription,

  applicationName: "LessonForge",

  keywords: [
    "lesson plan generator",
    "AI lesson plan",
    "lesson note generator",
    "African teachers",
    "Nigerian teachers",
    "WAEC lesson plan",
    "NERDC curriculum",
    "worksheet generator",
    "exam question generator",
    "teacher AI tools Africa",
  ],

  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "32x32" },
      { url: "/favicon-16x16.png", sizes: "16x16" },
      { url: "/favicon-32x32.png", sizes: "32x32" },
    ],
    apple: "/apple-touch-icon.png",
    other: [{ rel: "manifest", url: "/site.webmanifest" }],
  },

  openGraph: {
    title: "LessonForge - AI Lesson Planning for African Teachers",
    description: defaultDescription,
    url: "https://lessonforge.app",
    siteName: "LessonForge",
    images: [{ url: "/og-image.png", width: 1200, height: 630 }],
    locale: "en_NG",
    type: "website",
  },

  twitter: {
    card: "summary_large_image",
    title: "LessonForge - AI Lesson Planning for African Teachers",
    description: defaultDescription,
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
          <NetworkProvider>{children}</NetworkProvider>
        </ToastProvider>
      </body>
    </html>
  );
}
