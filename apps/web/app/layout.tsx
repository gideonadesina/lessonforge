 import "./globals.css";
 import Script from "next/script";

export const metadata = {
  title: "LessonForge",
  description: "AI Lesson Planning for Teachers",
  icons: {
    icon: "/favicon.png", // ✅ favicon from public folder
  },
};

export const viewport = { width: "device-width", initialScale: 1 };
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
