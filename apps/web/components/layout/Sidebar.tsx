"use client";

import Link from "next/link";
import { useEffect, type ComponentType } from "react";
import { usePathname } from "next/navigation";
import {
  CalendarDays,
  CreditCard,
  FileText,
  LayoutDashboard,
  Library,
  School,
  ScrollText,
  Settings,
  Sparkles,
} from "lucide-react";

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
  return (
    <aside className="h-full w-72 overflow-y-auto rounded-3xl border border-[var(--border)] bg-[var(--card)] p-3 text-[var(--text-primary)] shadow-sm transition-all duration-300">
      <div className="mb-4 flex items-center justify-between gap-2 rounded-2xl border border-[var(--border)] bg-[var(--card-alt)] px-3 py-3">
        <Link href="/dashboard" onClick={onNavigate} className="min-w-0">
          <img src="/lessonforge_logo_primary.svg" alt="LessonForge" height="48" />
        </Link>
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-[var(--text-primary)]">Teacher Workspace</p>
        </div>
      </div>

      <nav className="space-y-4">
        {teacherNav.map((section) => (
          <div key={section.label}>
            <p className="px-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--text-tertiary)]">
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
