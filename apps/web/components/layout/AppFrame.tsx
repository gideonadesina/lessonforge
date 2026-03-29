"use client";

import { useState } from "react";
import { usePathname } from "next/navigation";
import Sidebar from "@/components/layout/Sidebar";
import Topbar from "@/components/layout/Topbar";

export default function AppFrame({
  userEmail,
  children,
}: {
  userEmail: string;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const isPrincipalArea = pathname.startsWith("/principal");
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Skip rendering shared Topbar/Sidebar in principal area - use PrincipalLayout instead
  if (isPrincipalArea) {
    return <>{children}</>;
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <Sidebar open={sidebarOpen} setOpen={setSidebarOpen} />

        <main className="xl:pl-72">
        <div className="mx-auto max-w-6xl px-3 py-3 sm:px-4 sm:py-4">
          <Topbar userEmail={userEmail} onMenu={() => setSidebarOpen(true)} />
        </div>

         <div className="mx-auto max-w-6xl px-3 pb-8 sm:px-4 sm:pb-10">{children}</div>
      </main>
    </div>
  );
}