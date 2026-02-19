"use client";

import type { ReactNode } from "react";
import Sidebar from "./Sidebar";
import Topbar from "./Topbar";

type Props = {
  children: ReactNode;
  userEmail?: string;
};

export default function AppShell({ children, userEmail }: Props) {
  return (
    <div className="min-h-screen bg-slate-50">
      <div className="mx-auto max-w-[1400px] px-4 py-4">
        <div className="grid grid-cols-12 gap-4">

          {/* Sidebar */}
          <aside className="col-span-12 md:col-span-3 lg:col-span-2">
            <Sidebar />
          </aside>

          {/* Main Content */}
          <main className="col-span-12 md:col-span-9 lg:col-span-10">

            {/* Topbar */}
            <Topbar userEmail={userEmail ?? ""} />

            {/* Page content */}
            <div className="mt-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              {children}
            </div>

          </main>

        </div>
      </div>
    </div>
  );
}
