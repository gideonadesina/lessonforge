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
import { useProfile } from "@/lib/useProfile";
import { useToast } from "@/components/ui/ToastProvider";

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
  const [availableRoles, setAvailableRoles] = useState<AppRole[]>([]);
  const [activeRole, setActiveRole] = useState<AppRole | null>(null);
  const [switchingRole, setSwitchingRole] = useState<AppRole | null>(null);
  const [roleError, setRoleError] = useState<string | null>(null);
  const [roleMenuOpen, setRoleMenuOpen] = useState(false);
  const [shareMenuOpen, setShareMenuOpen] = useState(false);

  const roleMenuRef = useRef<HTMLDivElement | null>(null);
  const shareMenuRef = useRef<HTMLDivElement | null>(null);

  const supabase = useMemo(() => createBrowserSupabase(), []);
  const { profile, creditsRemaining, loading: profileLoading } = useProfile();
  const { showToast } = useToast();

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

      if (shareMenuRef.current && !shareMenuRef.current.contains(target)) {
        setShareMenuOpen(false);
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
      setRoleError(
        getAuthErrorMessage(error, "Unable to switch role right now.")
      );
    } finally {
      setSwitchingRole(null);
    }
  }

  const canSwitchRole = availableRoles.length > 1;

  const referralCode =
    profile?.referral_code ||
    (profile?.id ? String(profile.id).slice(0, 6).toUpperCase() : null);

  const referralLink = referralCode
    ? `https://lessonforge.app/signup?ref=${encodeURIComponent(referralCode)}`
    : "";

  const shareText = referralLink
    ? `I’ve been using LessonForge to create lesson packs faster. Sign up with my referral link: ${referralLink}`
    : "Check out LessonForge.";

  const whatsappShareUrl = `https://wa.me/?text=${encodeURIComponent(
    shareText
  )}`;

  const twitterShareUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(
    shareText
  )}`;

  const emailShareUrl = `mailto:?subject=${encodeURIComponent(
    "Try LessonForge"
  )}&body=${encodeURIComponent(shareText)}`;

  const smsShareUrl = `sms:?body=${encodeURIComponent(shareText)}`;

  async function copyReferralLink() {
    if (!referralLink) {
      showToast("Referral link unavailable right now.");
      return;
    }

    try {
      await navigator.clipboard.writeText(referralLink);
      showToast("🔗 Referral link copied!");
      setShareMenuOpen(false);
    } catch {
      showToast("Could not copy referral link.");
    }
  }

  async function handleShareReferral() {
    if (!referralLink) {
      showToast("Referral link unavailable right now.");
      return;
    }

    if (navigator.share) {
      try {
        await navigator.share({
          title: "LessonForge",
          text: "I’ve been using LessonForge to create lesson packs faster.",
          url: referralLink,
        });
        return;
      } catch {
        // User cancelled or native share failed, fall back to menu.
      }
    }

    setShareMenuOpen((current) => !current);
  }

  return (
    <>
      <div className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm md:flex-row md:items-center md:justify-between">
        <div className="min-w-0 flex items-center gap-3">
          <button
            onClick={onMenu}
            className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-white xl:hidden"
            aria-label="Open menu"
          >
            <span className="text-xl leading-none">☰</span>
          </button>

          <div className="min-w-0">
            <div className="text-sm font-semibold text-slate-900">Welcome 👋</div>
            <div className="truncate text-xs text-slate-500">
              {userEmail || "Signed in"}
            </div>
          </div>
        </div>

        <div className="relative w-full md:w-72">
          <input
            placeholder={
              isPrincipalArea
                ? "Search principal workspace..."
                : "Search lessons, topics..."
            }
            className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm outline-none focus:border-violet-400"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {canSwitchRole && !isPrincipalArea ? (
            <div ref={roleMenuRef} className="relative">
              <button
                type="button"
                onClick={() => setRoleMenuOpen((current) => !current)}
                className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-800 hover:bg-slate-50"
              >
                {switchingRole
                  ? "Switching..."
                  : `Role: ${
                      activeRole ? ROLE_CONTENT[activeRole].label : "Account"
                    }`}
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
                          {isActive
                            ? "Active"
                            : isSwitching
                            ? "Switching..."
                            : "Switch"}
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
             
              <div ref={shareMenuRef} className="relative">
                <button
                  type="button"
                  onClick={() => {
                    void handleShareReferral();
                  }}
                  className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-800 hover:bg-slate-50"
                >
                  Share
                </button>

                {shareMenuOpen ? (
                  <div className="absolute right-0 z-50 mt-2 w-64 rounded-2xl border border-slate-200 bg-white p-2 shadow-lg">
                    <div className="px-2 pb-2 pt-1">
                      <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                        Share referral
                      </div>
                      <div className="mt-1 text-xs text-slate-600">
                        Invite teachers and share your LessonForge referral link.
                      </div>
                    </div>

                    <div className="space-y-1">
                      <a
                        href={whatsappShareUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="block rounded-xl px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
                      >
                        WhatsApp
                      </a>

                      <a
                        href={twitterShareUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="block rounded-xl px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
                      >
                        X / Twitter
                      </a>

                      <a
                        href={emailShareUrl}
                        className="block rounded-xl px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
                      >
                        Email
                      </a>

                      <a
                        href={smsShareUrl}
                        className="block rounded-xl px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
                      >
                        SMS
                      </a>

                      <button
                        type="button"
                        onClick={() => {
                          void copyReferralLink();
                        }}
                        className="block w-full rounded-xl px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-50"
                      >
                        Copy link
                      </button>
                    </div>
                  </div>
                ) : null}
              </div>

              <Link
                href="/pricing"
                className="rounded-xl bg-violet-600 px-4 py-2 text-sm font-semibold text-white hover:bg-violet-700"
              >
                Upgrade
              </Link>
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
    </>
  );
}