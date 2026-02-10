// apps/web/app/layout.tsx
import "./globals.css";

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="antialiased min-h-screen selection:bg-indigo-800 selection:text-white bg-slate-50">
        {children}
      </body>
    </html>
  );
}
