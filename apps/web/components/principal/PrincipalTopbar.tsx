"use client";
 
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  Bell,
  ChevronDown,
  LogOut,
  Menu,
  Plus,
  Search,
  Settings,
  ShieldCheck,
  UserRound,
} from "lucide-react";
import {
  fetchRoleContext,
  getAuthErrorMessage,
  switchRole as switchRoleApi,
} from "@/lib/auth/client";
import {
  clearPersistedActiveRole,
  persistActiveRole,
  ROLE_CONTENT,
  type AppRole,
} from "@/lib/auth/roles";
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
  const [availableRoles, setAvailableRoles] = useState<AppRole[]>([]);
  const [activeRole, setActiveRole] = useState<AppRole | null>(null);
  const [switchingRole, setSwitchingRole] = useState<AppRole | null>(null);
  const [roleError, setRoleError] = useState<string | null>(null);
 
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

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const roleContext = await fetchRoleContext();
        if (!alive) return;
        setAvailableRoles(roleContext.availableRoles);
        setActiveRole(roleContext.activeRole);
      } catch {
        // Keep menu usable even if role API is unavailable.
      }
    })();

    return () => {
      alive = false;
    };
  }, []);
 
  async function logout() {
    try {
      setLoggingOut(true);
      clearPersistedActiveRole();
      await supabase.auth.signOut();
      window.location.href = "/login";
    } finally {
      setLoggingOut(false);
    }
  }

  async function handleSwitchRole(nextRole: AppRole) {
    if (switchingRole) return;
    setRoleError(null);
    setSwitchingRole(nextRole);
    try {
      const result = await switchRoleApi(nextRole);
      persistActiveRole(nextRole);
      setActiveRole(nextRole);
      setProfileOpen(false);
      window.location.href = result.homePath;
    } catch (error: unknown) {
      setRoleError(getAuthErrorMessage(error, "Unable to switch role right now."));
    } finally {
      setSwitchingRole(null);
    }
  }
 
  const firstName = principalName.trim().split(" ")[0] || "Principal";
  const avatarInitial = firstName.charAt(0).toUpperCase() || "P";
  const canSwitchRole = availableRoles.length > 1;
 
  return (
    <div className="rounded-3xl border border-slate-200 bg-white px-4 py-3 shadow-sm md:px-5 md:py-4">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-center">
        <div className="flex min-w-[260px] flex-1 items-center gap-3 xl:max-w-[360px]">
          <button
            type="button"
            onClick={onOpenMenu}
            className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-700 lg:hidden"
            aria-label="Open menu"
          >
            <Menu className="h-5 w-5" />
          </button>
 
          <div className="min-w-0">
            <p className="text-sm font-medium text-slate-500">
              {getGreetingByHour()},{" "}
              <span className="font-semibold text-slate-700">{firstName}</span>{" "}
              <span className="align-middle">👋</span>
            </p>
 
            <div className="mt-1 flex flex-wrap items-center gap-2">
              <p className="max-w-full truncate text-base font-semibold text-slate-900">
                {schoolName || "Your school workspace"}
              </p>
              <span className="inline-flex shrink-0 items-center rounded-full bg-violet-100 px-2 py-0.5 text-[11px] font-semibold text-violet-700">
                Principal
              </span>
            </div>
          </div>
        </div>
 
        <div className="min-w-0 flex-1 xl:px-2">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              placeholder="Search teachers, lessons, worksheets"
              className="w-full rounded-2xl border border-slate-200 bg-slate-50 py-3 pl-10 pr-3 text-sm text-slate-700 outline-none transition focus:border-violet-400 focus:bg-white"
            />
          </div>
        </div>
 
        <div className="flex shrink-0 items-center justify-end gap-2 xl:ml-auto">
          <button
            type="button"
            className="relative inline-flex h-11 w-11 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-700 transition hover:bg-slate-50"
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
              className="inline-flex items-center gap-2 rounded-2xl bg-violet-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-violet-700"
            >
              <Plus className="h-4 w-4 shrink-0" />
              <span className="hidden sm:inline">Quick actions</span>
              <span className="sm:hidden">Actions</span>
              <ChevronDown className="h-4 w-4 shrink-0" />
            </button>
 
            {quickOpen ? (
              <div className="absolute right-0 z-40 mt-2 w-56 rounded-2xl border border-slate-200 bg-white p-2 shadow-lg">
                <Link
                  href="/principal/teachers"
                  onClick={() => setQuickOpen(false)}
                  className="block rounded-xl px-3 py-2 text-sm text-slate-700 transition hover:bg-slate-50"
                >
                  Add teacher
                </Link>
                <Link
                  href="/principal/generate"
                  onClick={() => setQuickOpen(false)}
                  className="block rounded-xl px-3 py-2 text-sm text-slate-700 transition hover:bg-slate-50"
                >
                  Generate content
                </Link>
                <Link
                  href="/principal/billing"
                  onClick={() => setQuickOpen(false)}
                  className="block rounded-xl px-3 py-2 text-sm text-slate-700 transition hover:bg-slate-50"
                >
                  Upgrade slots
                </Link>
                <Link
                  href="/principal/analytics"
                  onClick={() => setQuickOpen(false)}
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
              <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-slate-900 text-xs font-semibold text-white">
                {avatarInitial}
              </span>
              <ChevronDown className="h-4 w-4 text-slate-500" />
            </button>
 
            {profileOpen ? (
              <div className="absolute right-0 z-40 mt-2 w-64 rounded-2xl border border-slate-200 bg-white p-2 shadow-lg">
                <div className="rounded-xl bg-slate-50 px-3 py-2">
                  <p className="truncate text-sm font-semibold text-slate-900">
                    {principalName}
                  </p>
                  <p className="truncate text-xs text-slate-500">
                    {email || "No email"}
                  </p>
                  <p className="mt-1 text-[11px] font-semibold uppercase tracking-wide text-violet-700">
                    {activeRole ? ROLE_CONTENT[activeRole].label : "Principal"}
                  </p>
                </div>
 
                {canSwitchRole ? (
                  <div className="mt-2 rounded-xl border border-slate-200 bg-white p-1.5">
                    <div className="px-2 pb-1 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                      Switch workspace
                    </div>
                    {availableRoles.map((candidateRole) => {
                      const isActive = candidateRole === activeRole;
                      const isSwitching = switchingRole === candidateRole;
                      return (
                        <button
                          key={candidateRole}
                          type="button"
                          disabled={isActive || Boolean(switchingRole)}
                          onClick={() => {
                            if (candidateRole === "principal") {
                              setProfileOpen(false);
                              return;
                            }
                            void handleSwitchRole(candidateRole);
                          }}
                          className={[
                            "flex w-full items-center justify-between rounded-lg px-2 py-2 text-left text-sm transition",
                            isActive
                              ? "cursor-default bg-violet-50 text-violet-700"
                              : "text-slate-700 hover:bg-slate-50",
                            switchingRole ? "opacity-70" : "",
                          ].join(" ")}
                        >
                          <span className="inline-flex items-center gap-2">
                            <UserRound className="h-4 w-4" />
                            {ROLE_CONTENT[candidateRole].label}
                          </span>
                          <span className="text-xs font-semibold">
                            {isActive ? "Active" : isSwitching ? "Switching..." : "Switch"}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                ) : null}
 
                <Link
                  href="/settings"
                  onClick={() => setProfileOpen(false)}
                  className="flex items-center gap-2 rounded-xl px-3 py-2 text-sm text-slate-700 transition hover:bg-slate-50"
                >
                  <Settings className="h-4 w-4" />
                  Settings
                </Link>
 
                <Link
                  href="/select-role"
                  onClick={() => setProfileOpen(false)}
                  className="flex items-center gap-2 rounded-xl px-3 py-2 text-sm text-slate-700 transition hover:bg-slate-50"
                >
                  <ShieldCheck className="h-4 w-4" />
                  Workspace center
                </Link>

                {roleError ? (
                  <div className="mx-2 my-1 rounded-lg border border-rose-200 bg-rose-50 px-2 py-1.5 text-xs text-rose-700">
                    {roleError}
                  </div>
                ) : null}
 
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