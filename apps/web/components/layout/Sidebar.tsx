"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, type ComponentType } from "react";
import { usePathname } from "next/navigation";
import {
  CalendarDays,
  AlertTriangle,
  ChevronDown,
  CreditCard,
  FileText,
  HelpCircle,
  LayoutDashboard,
  Library,
  School,
  ScrollText,
  Settings,
  Sparkles,
} from "lucide-react";
import { createBrowserSupabase } from "@/lib/supabase/browser";
import {
  writeClientCreditSource,
  type ClientCreditSource,
} from "@/lib/credits/source-preference";

type NavItem = {
  href: string;
  label: string;
  icon: ComponentType<{ className?: string }>;
  children?: Array<{ href: string; label: string }>;
};

type NavSection = {
  label: string;
  items: NavItem[];
};

const teacherNav: NavSection[] = [
  {
    label: "OVERVIEW",
    items: [{ href: "/dashboard", label: "Dashboard", icon: LayoutDashboard }],
  },
  {
    label: "CONTENT",
    items: [
      {
        href: "/generate",
        label: "Generate",
        icon: Sparkles,
        children: [{ href: "/generate/lesson-slides", label: "Lesson Slides" }],
      },
      { href: "/library", label: "Library", icon: Library },
      { href: "/worksheets", label: "Worksheets", icon: FileText },
    ],
  },
  {
    label: "TOOLS",
    items: [
      { href: "/planning", label: "Planning", icon: CalendarDays },
      { href: "/exam-builder", label: "Exam Builder", icon: ScrollText },
    ],
  },
  {
    label: "ACCOUNT",
    items: [
      { href: "/school", label: "School", icon: School },
      { href: "/pricing", label: "Pricing", icon: CreditCard },
      { href: "/settings", label: "Settings", icon: Settings },
      { href: "/help", label: "Help & Support", icon: HelpCircle },
    ],
  },
];

function isActive(href: string, pathname: string) {
  if (href === "/dashboard") return pathname === "/dashboard";
  return pathname === href || pathname.startsWith(`${href}/`);
}

function SidebarCard({
  pathname,
  onNavigate,
}: {
  pathname: string;
  onNavigate?: () => void;
}) {
  const supabase = useMemo(() => createBrowserSupabase(), []);
  const [creditSource, setCreditSource] = useState<ClientCreditSource>("school");
  const [schoolCredits, setSchoolCredits] = useState<number | null>(null);
  const [personalCredits, setPersonalCredits] = useState<number | null>(null);
  const [hasSchool, setHasSchool] = useState(false);
  const [creditPanelOpen, setCreditPanelOpen] = useState(false);

  useEffect(() => {
    let alive = true;
    (async () => {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      if (!token) return;

      const response = await fetch("/api/credits/source-status", {
        cache: "no-store",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!response.ok) return;
      const status = (await response.json()) as {
        hasSchool?: boolean;
        schoolCredits?: number;
        personalCredits?: number;
      };
      if (!alive) return;
      const personalBalance = Math.max(0, Number(status.personalCredits ?? 0));
      setPersonalCredits(personalBalance);
      const joinedSchool = Boolean(status.hasSchool);
      const sharedCredits = Math.max(0, Number(status.schoolCredits ?? 0));
      setHasSchool(joinedSchool);
      setSchoolCredits(joinedSchool ? sharedCredits : null);
      setCreditPanelOpen(joinedSchool && sharedCredits <= 0);

      const initialSource = joinedSchool && sharedCredits > 0 ? "school" : "personal";
      setCreditSource(initialSource);
      writeClientCreditSource(initialSource);
    })();

    return () => {
      alive = false;
    };
  }, [supabase]);

  function chooseCreditSource(source: ClientCreditSource) {
    setCreditSource(source);
    writeClientCreditSource(source);
  }

  const schoolCreditsValue = schoolCredits ?? 0;
  const personalCreditsValue = personalCredits ?? 0;
  const schoolCreditsActive = schoolCreditsValue > 0;
  const allCreditsExhausted = hasSchool && schoolCreditsValue === 0 && personalCreditsValue === 0;
  const schoolCreditsExhausted = hasSchool && schoolCreditsValue === 0 && personalCreditsValue > 0;

  return (
    <aside className="h-full max-h-[calc(100vh-2rem)] w-72 overflow-y-auto rounded-3xl border border-[var(--border)] bg-[var(--card)] p-3 text-[var(--text-primary)] shadow-sm transition-all duration-300">
      <div className="mb-4 flex items-center justify-between gap-2 rounded-2xl border border-[var(--border)] bg-[var(--card-alt)] px-3 py-3">
        <Link href="/dashboard" onClick={onNavigate} className="min-w-0">
          <img src="/lessonforge_logo_primary.svg" alt="LessonForge" height="48" />
        </Link>
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-[var(--text-primary)]">Teacher Workspace</p>
        </div>
      </div>

      <nav className="flex flex-col gap-1">
        {teacherNav.map((section) => (
          <div key={section.label}>
            <p className="px-2 text-xs font-semibold uppercase tracking-[0.16em] text-[var(--text-tertiary)]">
              {section.label}
            </p>
            <div className="mt-1 space-y-1">
              {section.items.map((item) => {
                const activeItem = isActive(item.href, pathname);
                const Icon = item.icon;

                return (
                  <div key={item.href}>
                    <Link
                      href={item.href}
                      onClick={onNavigate}
                      className={[
                        "flex items-center gap-3 rounded-xl border px-3 py-2 text-sm font-medium transition-all duration-200",
                        activeItem
                          ? "border-violet-200 bg-violet-50 text-violet-700"
                          : "border-transparent text-[var(--text-secondary)] hover:border-[var(--border)] hover:bg-[var(--card-alt)] hover:text-[var(--text-primary)]",
                      ].join(" ")}
                    >
                      <Icon className="h-4 w-4 shrink-0" />
                      <span>{item.label}</span>
                    </Link>

                    {item.children ? (
                      <div className="ml-6 mt-1 space-y-1">
                        {item.children.map((child) => {
                          const childActive = isActive(child.href, pathname);
                          return (
                            <Link
                              key={child.href}
                              href={child.href}
                              onClick={onNavigate}
                              className={[
                                "block rounded-xl border px-3 py-2 text-sm font-medium transition-all duration-200",
                                childActive
                                  ? "border-violet-200 bg-violet-50 text-violet-700"
                                  : "border-transparent text-[var(--text-secondary)] hover:border-[var(--border)] hover:bg-[var(--card-alt)] hover:text-[var(--text-primary)]",
                              ].join(" ")}
                            >
                              {child.label}
                            </Link>
                          );
                        })}
                      </div>
                    ) : null}

                    {section.label === "ACCOUNT" && item.href === "/school" && hasSchool ? (
                      <div
                        className={[
                          "mb-2 ml-6 mt-2 rounded-xl border p-2",
                          allCreditsExhausted
                            ? "border-rose-200 bg-rose-50 text-rose-800"
                            : schoolCreditsExhausted
                            ? "border-amber-200 bg-amber-50 text-amber-800"
                            : "border-[var(--border)] bg-[var(--card-alt)] text-[var(--text-primary)]",
                        ].join(" ")}
                      >
                        <button
                          type="button"
                          onClick={() => setCreditPanelOpen((current) => !current)}
                          className="flex w-full items-center justify-between gap-2 text-left text-xs font-bold"
                        >
                          <span className="inline-flex min-w-0 items-center gap-1.5">
                            {schoolCreditsActive ? null : <AlertTriangle className="h-3.5 w-3.5 shrink-0" />}
                            <span className="truncate">
                              {allCreditsExhausted
                                ? "No credits available"
                                : schoolCreditsExhausted
                                ? "School credits exhausted"
                                : "School credits active"}
                            </span>
                          </span>
                          <ChevronDown
                            className={[
                              "h-3.5 w-3.5 shrink-0 transition-transform",
                              creditPanelOpen ? "rotate-180" : "",
                            ].join(" ")}
                          />
                        </button>

                        {!creditPanelOpen && schoolCreditsActive ? (
                          <p className="mt-1 text-xs text-[var(--text-secondary)]">School credits active</p>
                        ) : null}

                        {creditPanelOpen ? (
                          <div className="mt-2 space-y-2">
                            {schoolCreditsExhausted ? (
                              <p className="text-xs font-semibold">
                                School credits exhausted — switch to personal credits or ask your principal to top up.
                              </p>
                            ) : null}

                            {allCreditsExhausted ? (
                              <div className="space-y-2">
                                <p className="text-xs font-semibold">
                                  School and personal credits are both exhausted.
                                </p>
                                <Link
                                  href="/pricing"
                                  onClick={onNavigate}
                                  className="inline-flex w-full items-center justify-center rounded-lg bg-rose-700 px-2 py-1.5 text-xs font-bold text-white hover:bg-rose-800"
                                >
                                  Top up personal credits
                                </Link>
                              </div>
                            ) : (
                              <>
                                <div className="grid grid-cols-2 gap-1">
                                  {(["school", "personal"] as ClientCreditSource[]).map((source) => (
                                    <button
                                      key={source}
                                      type="button"
                                      onClick={() => chooseCreditSource(source)}
                                      disabled={source === "school" && schoolCreditsValue === 0}
                                      className={[
                                        "rounded-lg px-2 py-1.5 text-xs font-bold disabled:cursor-not-allowed disabled:opacity-50",
                                        creditSource === source
                                          ? "bg-violet-700 text-white"
                                          : "text-[var(--text-secondary)] hover:bg-[var(--card)]",
                                      ].join(" ")}
                                    >
                                      {source === "school" ? "School Credits" : "Personal Credits"}
                                    </button>
                                  ))}
                                </div>
                                <div className="text-xs text-[var(--text-secondary)]">
                                  {creditSource === "personal" ? (
                                    <div className="space-y-2">
                                      <p>
                                        Personal balance:{" "}
                                        <span className="font-bold text-[var(--text-primary)]">{personalCreditsValue}</span>
                                      </p>
                                      <Link
                                        href="/pricing"
                                        onClick={onNavigate}
                                        className="inline-flex w-full items-center justify-center rounded-lg border border-[var(--border)] bg-[var(--card)] px-2 py-1.5 font-bold text-[var(--text-primary)] hover:bg-white"
                                      >
                                        Top up
                                      </Link>
                                    </div>
                                  ) : (
                                    <p>
                                      School balance:{" "}
                                      <span className="font-bold text-[var(--text-primary)]">{schoolCreditsValue}</span>
                                    </p>
                                  )}
                                </div>
                              </>
                            )}
                          </div>
                        ) : null}
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </nav>
    </aside>
  );
}

export default function Sidebar({
  open,
  setOpen,
}: {
  open: boolean;
  setOpen: (v: boolean) => void;
}) {
  const pathname = usePathname();

  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [open]);

  useEffect(() => {
    if (open) {
      setOpen(false);
    }
    // Run only on route changes to collapse drawer after navigation.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  return (
    <>
      <div className="hidden xl:block">
        <div className="fixed inset-y-0 left-0 z-30 p-4">
          <SidebarCard pathname={pathname} />
        </div>
      </div>

      {open ? (
        <button
          className="fixed inset-0 z-40 bg-slate-950/35 xl:hidden"
          aria-label="Close menu"
          onClick={() => setOpen(false)}
        />
      ) : null}

      <div
        className={[
          "fixed inset-y-0 left-0 z-50 p-4 transition-transform duration-300 ease-out xl:hidden",
          open ? "translate-x-0" : "-translate-x-full",
        ].join(" ")}
      >
        <SidebarCard pathname={pathname} onNavigate={() => setOpen(false)} />
      </div>
    </>
  );
}
