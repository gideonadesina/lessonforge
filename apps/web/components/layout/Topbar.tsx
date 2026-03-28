"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { usePathname } from "next/navigation";
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

export default function Topbar({
  userEmail,
  onMenu,
}: {
  userEmail: string;
  onMenu: () => void;
}) {
   const pathname = usePathname();
  const isPrincipalArea = pathname.startsWith("/principal");
  const [loading, setLoading] = useState(false);
  const [plansOpen, setPlansOpen] = useState(false);
  const [availableRoles, setAvailableRoles] = useState<AppRole[]>([]);
  const [activeRole, setActiveRole] = useState<AppRole | null>(null);
  const [switchingRole, setSwitchingRole] = useState<AppRole | null>(null);
  const [roleError, setRoleError] = useState<string | null>(null);
  const [roleMenuOpen, setRoleMenuOpen] = useState(false);
  const roleMenuRef = useRef<HTMLDivElement | null>(null);

  const supabase = useMemo(() => createBrowserSupabase(), []);

  useEffect(() => {
    void (async () => {
      try {
        const roleContext = await fetchRoleContext();
        setAvailableRoles(roleContext.availableRoles);
        setActiveRole(roleContext.activeRole);
      } catch {
        // Keep topbar resilient if role API is unavailable.
      }
    })();
  }, []);

  useEffect(() => {
    function onDocumentClick(event: MouseEvent) {
      const target = event.target as Node;
      if (roleMenuRef.current && !roleMenuRef.current.contains(target)) {
        setRoleMenuOpen(false);
      }
    }

    document.addEventListener("mousedown", onDocumentClick);
    return () => document.removeEventListener("mousedown", onDocumentClick);
  }, []);

  async function logout() {
    try {
      setLoading(true);
      clearPersistedActiveRole();
      await supabase.auth.signOut();
      window.location.href = "/login";
    } finally {
      setLoading(false);
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
      setRoleMenuOpen(false);
      window.location.href = result.homePath;
    } catch (error: unknown) {
      setRoleError(getAuthErrorMessage(error, "Unable to switch role right now."));
    } finally {
      setSwitchingRole(null);
    }
  }

  const canSwitchRole = availableRoles.length > 1;

  async function upgradePlan(tier: "basic" | "pro") {
    const [{ data: userData }, { data: sessionData }] = await Promise.all([
      supabase.auth.getUser(),
      supabase.auth.getSession(),
    ]);
    const user = userData.user;
    const token = sessionData.session?.access_token;
    if (!user || !token) return;

    const res = await fetch("/api/paystack/initialize", {
      method: "POST",
     headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        
        currency: "NGN",
        tier,
      }),
    });

    const json = await res.json();

    if (!res.ok) {
      console.log(json);
      alert(json?.error || "Payment init failed");
      return;
    }

    window.location.href = json.authorization_url;
  }

  return (
    <>
      <div className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm md:flex-row md:items-center md:justify-between">
        {/* LEFT */}
        <div className="flex items-center gap-3 min-w-0">
          {/* ✅ Menu button for mobile/tablet */}
          <button
            onClick={onMenu}
            className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-white xl:hidden"
            aria-label="Open menu"
          >
            <span className="text-xl leading-none">☰</span>
          </button>

          <div className="min-w-0">
            <div className="text-sm font-semibold text-slate-900">Welcome 👋</div>
            <div className="text-xs text-slate-500 truncate">
              {userEmail || "Signed in"}
            </div>
          </div>
        </div>

        {/* CENTER */}
        <div className="relative w-full md:w-72">
          <input
             placeholder={isPrincipalArea ? "Search principal workspace..." : "Search lessons, topics..."}
            className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm outline-none focus:border-violet-400"
          />
        </div>

        {/* RIGHT */}
         <div className="flex flex-wrap items-center gap-2">
          {canSwitchRole && !isPrincipalArea ? (
            <div ref={roleMenuRef} className="relative">
              <button
                type="button"
                onClick={() => setRoleMenuOpen((current) => !current)}
                className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-800 hover:bg-slate-50"
              >
                {switchingRole ? "Switching..." : `Role: ${activeRole ? ROLE_CONTENT[activeRole].label : "Account"}`}
              </button>
              {roleMenuOpen ? (
                <div className="absolute right-0 z-50 mt-2 w-56 rounded-xl border border-slate-200 bg-white p-2 shadow-md">
                  {availableRoles.map((candidateRole) => {
                    const isActive = candidateRole === activeRole;
                    const isSwitching = switchingRole === candidateRole;
                    return (
                      <button
                        key={candidateRole}
                        type="button"
                        disabled={isActive || Boolean(switchingRole)}
                        onClick={() => {
                          void handleSwitchRole(candidateRole);
                        }}
                        className={[
                          "flex w-full items-center justify-between rounded-lg px-2 py-2 text-left text-sm transition",
                          isActive
                            ? "cursor-default bg-violet-50 text-violet-700"
                            : "text-slate-700 hover:bg-slate-50",
                        ].join(" ")}
                      >
                        <span>{ROLE_CONTENT[candidateRole].label}</span>
                        <span className="text-xs font-semibold">
                          {isActive ? "Active" : isSwitching ? "Switching..." : "Switch"}
                        </span>
                      </button>
                    );
                  })}
                  {roleError ? (
                    <div className="mt-1 rounded-lg border border-rose-200 bg-rose-50 px-2 py-1 text-xs text-rose-700">
                      {roleError}
                    </div>
                  ) : null}
                </div>
              ) : null}
            </div>
          ) : null}
          {isPrincipalArea ? (
            <>
              <Link
                href="/principal/generate"
                className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-800 hover:bg-slate-50"
              >
                Generate
              </Link>
              <Link
                href="/principal/library"
                className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-800 hover:bg-slate-50"
              >
                Library
              </Link>
              <Link
                href="/principal/billing"
                className="rounded-xl bg-slate-900 px-3 py-2 text-sm font-semibold text-white hover:bg-slate-800"
              >
                Manage billing
              </Link>
            </>
          ) : (
            <>
              {/* ✅ Mobile: show Upgrade button that opens a modal (works on iOS) */}
              <button
                onClick={() => setPlansOpen(true)}
                className="sm:hidden rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800"
              >
                Upgrade
              </button>


          {/* Desktop/tablet (sm+) */}
           {/* Desktop/tablet (sm+) */}
              <button
                onClick={() => upgradePlan("basic")}
                className="hidden rounded-xl border bg-white px-4 py-2 text-sm font-semibold hover:bg-slate-50 sm:inline-flex"
              >
                Basic ₦2,000/mo
              </button>

              <button
                onClick={() => upgradePlan("pro")}
                className="hidden rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800 sm:inline-flex"
              >
                Pro ₦5,000/mo
              </button>
            </>
          )}

          <button
            onClick={logout}
            disabled={loading}
            className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-800 hover:bg-slate-100 disabled:opacity-60"
          >
            {loading ? "Logging out..." : "Logout"}
          </button>
        </div>
      </div>
       {isPrincipalArea ? (
        <div className="mt-2 flex gap-2 overflow-x-auto pb-1">
          {[
            { href: "/principal", label: "Dashboard" },
            { href: "/principal/teachers", label: "Teachers" },
            { href: "/principal/workspace", label: "Workspace" },
            { href: "/principal/planning", label: "Planning" },
            { href: "/principal/analytics", label: "Analytics" },
            { href: "/principal/billing", label: "Billing" },
          ].map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={[
                "whitespace-nowrap rounded-full border px-3 py-1.5 text-xs font-semibold transition",
                pathname === link.href
                  ? "border-violet-200 bg-violet-50 text-violet-700"
                  : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50",
              ].join(" ")}
            >
              {link.label}
            </Link>
          ))}
        </div>
      ) : null}
      

      {/* ✅ Upgrade Modal (mobile) */}
      {plansOpen && !isPrincipalArea && (
        <>
          <button
            className="fixed inset-0 z-50 bg-black/40"
            aria-label="Close upgrade modal"
            onClick={() => setPlansOpen(false)}
          />
          <div className="fixed left-0 right-0 bottom-0 z-50 rounded-t-3xl bg-white p-4 shadow-xl">
            <div className="flex items-center justify-between">
              <div className="text-sm font-semibold text-slate-900">Upgrade Plan</div>
              <button
                className="h-10 w-10 rounded-xl border border-slate-200 bg-white"
                onClick={() => setPlansOpen(false)}
                aria-label="Close"
              >
                ✕
              </button>
            </div>

            <div className="mt-3 grid gap-2">
              <button
                onClick={() => upgradePlan("basic")}
                className="w-full rounded-xl border bg-white px-4 py-3 text-sm font-semibold hover:bg-slate-50"
              >
                Basic ₦2,000
              </button>
              <button
                onClick={() => upgradePlan("pro")}
                className="w-full rounded-xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white hover:bg-slate-800"
              >
                Pro ₦5,000
              </button>
            </div>
          </div>
        </>
      )}
    </>
  );
}