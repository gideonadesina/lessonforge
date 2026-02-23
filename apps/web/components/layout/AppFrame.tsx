"use client";

import { useState } from "react";
import Sidebar from "@/components/layout/Sidebar";
import Topbar from "@/components/layout/Topbar";

export default function AppFrame({
  userEmail,
  children,
}: {
  userEmail: string;
  children: React.ReactNode;
}) {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="min-h-screen bg-slate-50">
      <Sidebar open={sidebarOpen} setOpen={setSidebarOpen} />

      {/* match Sidebar desktop width: w-80 => lg:pl-80 */}
      <main className="lg:pl-72">
        <div className="mx-auto max-w-6xl px-4 py-4">
          <Topbar userEmail={userEmail} onMenu={() => setSidebarOpen(true)} />
        </div>

        <div className="mx-auto max-w-6xl px-4 pb-10">{children}</div>
      </main>
    </div>
  );
}