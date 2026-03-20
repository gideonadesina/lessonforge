"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { Bell, ChevronDown, LogOut, Menu, Plus, Search, Settings, ShieldCheck, UserRound } from "lucide-react";
import { createBrowserSupabase } from "@/lib/supabase/browser";

type PrincipalTopbarProps = {
  onOpenMenu: () => void;
  principalName: string;
  schoolName: string | null;
  email: string | null;
  notificationCount: number;
};

function getGreetingByHour() {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

export default function PrincipalTopbar({
  onOpenMenu,
  principalName,
  schoolName,
  email,
  notificationCount,
}: PrincipalTopbarProps) {
  const supabase = useMemo(() => createBrowserSupabase(), []);
  const [quickOpen, setQuickOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);

  const quickRef = useRef<HTMLDivElement | null>(null);
  const profileRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    function onDocumentClick(event: MouseEvent) {
      const target = event.target as Node;
      if (quickRef.current && !quickRef.current.contains(target)) {
        setQuickOpen(false);
      }
      if (profileRef.current && !profileRef.current.contains(target)) {
        setProfileOpen(false);
      }
    }

    document.addEventListener("mousedown", onDocumentClick);
    return () => document.removeEventListener("mousedown", onDocumentClick);
  }, []);

  async function logout() {
    try {
      setLoggingOut(true);
      await supabase.auth.signOut();
      window.location.href = "/login";
    } finally {
      setLoggingOut(false);
    }
  }

  const firstName = principalName.trim().split(" ")[0] || "Principal";
  const avatarInitial = firstName.charAt(0).toUpperCase() || "P";

  return (
    <div className="rounded-3xl border border-slate-200 bg-white px-4 py-3 shadow-sm md:px-5 md:py-4">
      <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
        <div className="flex min-w-0 items-center gap-3">
          <button
            type="button"
            onClick={onOpenMenu}
            className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-700 lg:hidden"
            aria-label="Open menu"
          >
            <Menu className="h-5 w-5" />
          </button>

          <div className="min-w-0">
            <p className="text-sm font-medium text-slate-500">
              {getGreetingByHour()}, {firstName} <span className="align-middle">👋</span>
            </p>
            <div className="mt-0.5 flex items-center gap-2">
              <p className="truncate text-base font-semibold text-slate-900">{schoolName || "Your school workspace"}</p>
              <span className="inline-flex items-center rounded-full bg-violet-100 px-2 py-0.5 text-[11px] font-semibold text-violet-700">
                Principal
              </span>
            </div>
          </div>
        </div>

        <div className="relative w-full xl:max-w-md">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            placeholder="Search teachers, lessons, worksheets"
            className="w-full rounded-2xl border border-slate-200 bg-slate-50 py-2 pl-9 pr-3 text-sm text-slate-700 outline-none transition focus:border-violet-400 focus:bg-white"
          />
        </div>

        <div className="flex items-center justify-end gap-2">
          <button
            type="button"
            className="relative inline-flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-700 transition hover:bg-slate-50"
            aria-label="Notifications"
          >
            <Bell className="h-4 w-4" />
            {notificationCount > 0 ? (
              <span className="absolute -right-1 -top-1 inline-flex min-h-5 min-w-5 items-center justify-center rounded-full bg-violet-600 px-1 text-[10px] font-semibold text-white">
                {notificationCount > 9 ? "9+" : notificationCount}
              </span>
            ) : null}
          </button>

          <div ref={quickRef} className="relative">
            <button
              type="button"
              onClick={() => setQuickOpen((value) => !value)}
              className="inline-flex items-center gap-2 rounded-xl bg-violet-600 px-3 py-2 text-sm font-semibold text-white transition hover:bg-violet-700"
            >
              <Plus className="h-4 w-4" />
              Quick actions
              <ChevronDown className="h-4 w-4" />
            </button>
            {quickOpen ? (
              <div className="absolute right-0 z-40 mt-2 w-56 rounded-2xl border border-slate-200 bg-white p-2 shadow-lg">
                <Link
                  href="/principal?view=teachers"
                  className="block rounded-xl px-3 py-2 text-sm text-slate-700 transition hover:bg-slate-50"
                >
                  Add teacher
                </Link>
                <Link
                  href="/principal?view=generate"
                  className="block rounded-xl px-3 py-2 text-sm text-slate-700 transition hover:bg-slate-50"
                >
                  Generate content
                </Link>
                <Link
                  href="/principal?view=slots"
                  className="block rounded-xl px-3 py-2 text-sm text-slate-700 transition hover:bg-slate-50"
                >
                  Upgrade slots
                </Link>
                <Link
                  href="/principal?view=analytics"
                  className="block rounded-xl px-3 py-2 text-sm text-slate-700 transition hover:bg-slate-50"
                >
                  View reports
                </Link>
              </div>
            ) : null}
          </div>

          <div ref={profileRef} className="relative">
            <button
              type="button"
              onClick={() => setProfileOpen((value) => !value)}
              className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-2 py-1.5 transition hover:bg-slate-50"
            >
              <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-slate-900 text-xs font-semibold text-white">
                {avatarInitial}
              </span>
              <ChevronDown className="h-4 w-4 text-slate-500" />
            </button>

            {profileOpen ? (
              <div className="absolute right-0 z-40 mt-2 w-64 rounded-2xl border border-slate-200 bg-white p-2 shadow-lg">
                <div className="rounded-xl bg-slate-50 px-3 py-2">
                  <p className="truncate text-sm font-semibold text-slate-900">{principalName}</p>
                  <p className="truncate text-xs text-slate-500">{email || "No email"}</p>
                </div>
                <button
                  type="button"
                  disabled
                  className="mt-2 flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-sm text-slate-400"
                >
                  <UserRound className="h-4 w-4" />
                  Switch role (coming soon)
                </button>
                <Link
                  href="/principal?view=settings"
                  className="flex items-center gap-2 rounded-xl px-3 py-2 text-sm text-slate-700 transition hover:bg-slate-50"
                >
                  <Settings className="h-4 w-4" />
                  Settings
                </Link>
                <Link
                  href="/select-role"
                  className="flex items-center gap-2 rounded-xl px-3 py-2 text-sm text-slate-700 transition hover:bg-slate-50"
                >
                  <ShieldCheck className="h-4 w-4" />
                  Role center
                </Link>
                <button
                  type="button"
                  onClick={logout}
                  disabled={loggingOut}
                  className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-sm font-medium text-rose-700 transition hover:bg-rose-50 disabled:opacity-60"
                >
                  <LogOut className="h-4 w-4" />
                  {loggingOut ? "Logging out..." : "Logout"}
                </button>
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
