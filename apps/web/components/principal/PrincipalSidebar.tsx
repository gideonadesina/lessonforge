"use client";
 
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { LucideIcon } from "lucide-react";
import {
  Building2,
  CalendarDays,
  ChartColumn,
  ChevronLeft,
  ChevronRight,
  CreditCard,
  LayoutDashboard,
  Library,
  Sparkles,
  Users,
} from "lucide-react";
 
type PrincipalSidebarProps = {
  mobileOpen: boolean;
  setMobileOpen: (open: boolean) => void;
  collapsed: boolean;
  setCollapsed: (collapsed: boolean) => void;
};
 
type NavItem = {
  label: string;
  href: string;
  icon: LucideIcon;
};
 
type NavSection = {
  title: string;
  items: NavItem[];
};
 
const NAV_SECTIONS: NavSection[] = [
  {
    title: "Main",
    items: [
      { label: "Dashboard", href: "/principal", icon: LayoutDashboard },
      { label: "Teachers", href: "/principal/teachers", icon: Users },
      { label: "Generate", href: "/principal/generate", icon: Sparkles },
      { label: "Library", href: "/principal/library", icon: Library },
    ],
  },
  {
    title: "Management",
    items: [
      { label: "School Workspace", href: "/principal/workspace", icon: Building2 },
      { label: "Planning", href: "/principal/planning", icon: CalendarDays },
      { label: "Analytics", href: "/principal/analytics", icon: ChartColumn },
    ],
  },
  {
    title: "Billing",
    items: [{ label: "Subscription / Billing", href: "/principal/billing", icon: CreditCard }],
  },
];
 
function isActive(href: string, pathname: string) {
  if (href === "/principal") return pathname === "/principal";
  return pathname === href || pathname.startsWith(`${href}/`);
}
 
function SidebarCard({
  collapsed,
  pathname,
  onNavigate,
  onCollapseToggle,
}: {
  collapsed: boolean;
  pathname: string;
  onNavigate?: () => void;
  onCollapseToggle?: () => void;
}) {
  return (
    <aside
      className={[
        "h-full overflow-y-auto rounded-3xl border border-slate-200 bg-white p-3 shadow-sm",
        "transition-all duration-300",
        collapsed ? "w-24" : "w-72",
      ].join(" ")}
    >
      <div className="mb-4 flex items-center justify-between gap-2 rounded-2xl border border-slate-200 bg-slate-50 px-3 py-3">
        <div className={collapsed ? "w-full text-center" : "min-w-0"}>
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-violet-700">LessonForge</p>
          {!collapsed ? (
            <p className="truncate text-sm font-semibold text-slate-900">Principal Command Center</p>
          ) : null}
        </div>
        {onCollapseToggle ? (
          <button
            type="button"
            onClick={onCollapseToggle}
            className="hidden h-8 w-8 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 transition hover:border-slate-300 hover:text-slate-900 lg:inline-flex"
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
          </button>
        ) : null}
      </div>
 
      <nav className="space-y-4">
        {NAV_SECTIONS.map((section) => (
          <div key={section.title}>
            {!collapsed ? (
              <p className="px-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-400">
                {section.title}
              </p>
            ) : null}
            <div className={collapsed ? "space-y-1" : "mt-1 space-y-1"}>
              {section.items.map((item) => {
                const activeItem = isActive(item.href, pathname);
                const Icon = item.icon;
                return (
                  <div key={item.label} className="group relative">
                    <Link
                      href={item.href}
                      onClick={onNavigate}
                      className={[
                        "flex items-center rounded-xl border px-3 py-2 text-sm font-medium transition-all duration-200",
                        collapsed ? "justify-center" : "gap-3",
                        activeItem
                          ? "border-violet-200 bg-violet-50 text-violet-700"
                          : "border-transparent text-slate-600 hover:border-slate-200 hover:bg-slate-50 hover:text-slate-900",
                      ].join(" ")}
                    >
                      <Icon className="h-4 w-4 shrink-0" />
                      {!collapsed ? <span>{item.label}</span> : null}
                    </Link>
 
                    {collapsed ? (
                      <span className="pointer-events-none absolute left-full top-1/2 z-50 ml-2 -translate-y-1/2 whitespace-nowrap rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs font-semibold text-slate-700 opacity-0 shadow-sm transition group-hover:opacity-100">
                        {item.label}
                      </span>
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
 
export default function PrincipalSidebar({
  mobileOpen,
  setMobileOpen,
  collapsed,
  setCollapsed,
}: PrincipalSidebarProps) {
  const pathname = usePathname();
 
  return (
    <>
      <div className="hidden lg:block">
        <div className="fixed inset-y-0 left-0 z-30 p-4">
          <SidebarCard
            collapsed={collapsed}
            pathname={pathname}
            onCollapseToggle={() => setCollapsed(!collapsed)}
          />
        </div>
      </div>
 
      {mobileOpen ? (
        <button
          className="fixed inset-0 z-40 bg-slate-950/35 lg:hidden"
          aria-label="Close principal menu"
          onClick={() => setMobileOpen(false)}
        />
      ) : null}
 
      <div
        className={[
          "fixed inset-y-0 left-0 z-50 p-4 transition-transform duration-300 ease-out lg:hidden",
          mobileOpen ? "translate-x-0" : "-translate-x-full",
        ].join(" ")}
      >
        <SidebarCard
          collapsed={false}
          pathname={pathname}
          onNavigate={() => setMobileOpen(false)}
        />
      </div>
    </>
  );
}