"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, type ComponentType } from "react";
import { usePathname } from "next/navigation";
import { createBrowserSupabase } from "@/lib/supabase/browser";

import {
  LayoutDashboard,
  Users,
  Sparkles,
  Library,
  FileText,
  CalendarDays,
  School,
  ScrollText,
  BarChart3,
  CreditCard,
  Settings,
} from "lucide-react";

type Profile = {
  full_name?: string | null;
  avatar_url?: string | null;
};

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
        children: [
          { href: "/generate/lesson-slides", label: "Lesson Slides" },
        ],
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
const principalNav: NavItem[] = [
  { href: "/principal", label: "Dashboard", icon: LayoutDashboard },
  { href: "/principal/teachers", label: "Teachers", icon: Users },
  { href: "/principal/generate", label: "Generate", icon: Sparkles },
  { href: "/principal/library", label: "Library", icon: Library },
  { href: "/principal/workspace", label: "Workspace", icon: School },
  { href: "/principal/planning", label: "Planning", icon: CalendarDays },
  { href: "/principal/analytics", label: "Analytics", icon: BarChart3 },
  { href: "/principal/billing", label: "Billing", icon: CreditCard },
];


export default function Sidebar({
  open,
  setOpen,
}: {
  open: boolean;
  setOpen: (v: boolean) => void;
}) {
  const pathname = usePathname();
  const isPrincipalArea = pathname.startsWith("/principal");
  const navSections = isPrincipalArea ? principalNav : teacherNav;

  // ✅ create supabase client once
  const supabase = useMemo(() => createBrowserSupabase(), []);

  const [profile, setProfile] = useState<Profile | null>(null);
  const [email, setEmail] = useState<string>("");
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    loadUser();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Prevent body scroll when drawer is open
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

   useEffect(() => {
    if (open) {
      setOpen(false);
    }
    // Run only on route changes to collapse drawer after navigation.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  async function loadUser() {
    const { data } = await supabase.auth.getUser();
    const user = data.user;
    if (!user) return;

    setEmail(user.email ?? "");

    const { data: profileData } = await supabase
      .from("profiles")
      .select("full_name, avatar_url")
      .eq("id", user.id)
      .single();

    setProfile(profileData ?? null);
  }

  async function uploadAvatar(e: React.ChangeEvent<HTMLInputElement>) {
    try {
      setUploading(true);
      const file = e.target.files?.[0];
      if (!file) return;

      const { data } = await supabase.auth.getUser();
      const user = data.user;
      if (!user) return;

      const fileExt = file.name.split(".").pop() || "jpg";
      const filePath = `${user.id}/${Date.now()}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from("avatars")
        .upload(filePath, file, { upsert: true });

      if (uploadError) throw uploadError;

      const { data: publicUrl } = supabase.storage
        .from("avatars")
        .getPublicUrl(filePath);

      const url = publicUrl.publicUrl;

      await supabase.from("profiles").update({ avatar_url: url }).eq("id", user.id);

      setProfile((p) => ({ ...(p ?? {}), avatar_url: url }));
    } catch (err) {
      console.error(err);
      alert("Avatar upload failed");
    } finally {
      setUploading(false);
    }
  }

  const avatar =
    profile?.avatar_url ||
    `https://ui-avatars.com/api/?name=${encodeURIComponent(
      profile?.full_name || email || "User"
    )}&background=6366f1&color=fff`;

  const SidebarCard = ({ onNavigate }: { onNavigate?: () => void }) => (
    <aside className="flex h-full min-h-0 flex-col rounded-2xl border border-[var(--border)] bg-[var(--card)] p-4 shadow-sm text-[var(--text-primary)]">
      {/* User */}
      <div className="flex shrink-0 items-center gap-3 border-b border-[var(--border)] pb-4">
        <label className="relative cursor-pointer">
          <img
            src={avatar}
            alt="avatar"
            className="h-12 w-12 rounded-full border border-[var(--border)] object-cover"
          />
          <input
            type="file"
            accept="image/*"
            onChange={uploadAvatar}
            disabled={uploading}
            className="hidden"
          />
        </label>

        <div className="min-w-0">
          <div className="truncate text-sm font-semibold text-[var(--text-primary)]">
            {profile?.full_name || "Your Name"}
          </div>
          <div className="truncate text-xs text-[var(--text-secondary)]">{email}</div>
          <div className="text-[11px] text-[var(--text-tertiary)]">
            {uploading ? "Uploading..." : "Click photo to change"}
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav className="mt-4 flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto pr-1">
        {!isPrincipalArea ? (
          (navSections as NavSection[]).map((section: NavSection) => (
            <div key={section.label}>
              <div className="px-3 py-1 text-[10px] font-semibold uppercase tracking-widest text-[var(--text-tertiary)]">
                {section.label}
              </div>
              <div className="mt-2 flex flex-col gap-1">
                {section.items.map((item: NavItem) => {
                  const active =
                    item.href === "/dashboard"
                      ? pathname === "/dashboard"
                      : pathname === item.href ||
                        pathname.startsWith(item.href + "/");
                  const Icon = item.icon;

                  return (
                    <div key={item.href}>
                      <Link
                        href={item.href}
                        onClick={() => setOpen(false)}
                        className={[
                          "flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium transition",
                          active
                            ? "bg-violet-50 text-violet-700 border border-violet-100 dark:bg-violet-900/30 dark:text-violet-400 dark:border-violet-900"
                            : "text-[var(--text-secondary)] hover:bg-[var(--card-alt)]",
                        ].join(" ")}
                      >
                        <Icon className="h-4 w-4" />
                        {item.label}
                      </Link>

                      {item.children ? (
                        <div className="ml-6 mt-1 flex flex-col gap-1">
                          {item.children.map((child) => {
                            const childActive =
                              pathname === child.href ||
                              pathname.startsWith(child.href + "/");
                            return (
                              <Link
                                key={child.href}
                                href={child.href}
                                onClick={() => setOpen(false)}
                                className={[
                                  "rounded-lg px-3 py-1.5 text-xs font-medium transition",
                                  childActive
                                    ? "bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400"
                                    : "text-[var(--text-secondary)] hover:bg-[var(--card-alt)]",
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
          ))
        ) : (
          /* Principal nav - keep old structure for now */
          (navSections as NavItem[]).map((item: NavItem) => {
            const active =
              item.href === "/principal"
                ? pathname === "/principal"
                : pathname === item.href || pathname.startsWith(item.href + "/");
            const Icon = item.icon;

            return (
              <div key={item.href}>
                <Link
                  href={item.href}
                  onClick={() => setOpen(false)}
                  className={[
                    "flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium transition",
                    active
                      ? "bg-violet-50 text-violet-700 border border-violet-100 dark:bg-violet-900/30 dark:text-violet-400 dark:border-violet-900"
                      : "text-[var(--text-secondary)] hover:bg-[var(--card-alt)]",
                  ].join(" ")}
                >
                  <Icon className="h-4 w-4" />
                  {item.label}
                </Link>

                {item.children ? (
                  <div className="ml-6 mt-1 flex flex-col gap-1">
                    {item.children.map((child) => {
                      const childActive =
                        pathname === child.href ||
                        pathname.startsWith(child.href + "/");
                      return (
                        <Link
                          key={child.href}
                          href={child.href}
                          onClick={() => setOpen(false)}
                          className={[
                            "rounded-lg px-3 py-1.5 text-xs font-medium transition",
                            childActive
                              ? "bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400"
                              : "text-[var(--text-secondary)] hover:bg-[var(--card-alt)]",
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
          })
        )}
      </nav>

    </aside>
  );

  return (
    <>
    {/* Desktop sidebar (xl+) fixed left */}
      <div className="hidden xl:block">
        <div className="fixed inset-y-0 left-0 z-30 w-72 p-4">
          <SidebarCard />
        </div>
      </div>

      {/* Mobile/Tablet overlay */}
       <button
        aria-label="Close menu overlay"
        className={[
          "fixed inset-0 z-40 bg-black/35 transition-opacity xl:hidden",
          open ? "opacity-100" : "pointer-events-none opacity-0",
        ].join(" ")}
        onClick={() => setOpen(false)}
      />

      {/* Mobile/Tablet drawer */}
      <div
        className={[
          "fixed inset-y-0 left-0 z-50 w-[88vw] max-w-[24rem] p-3 pt-[max(0.75rem,env(safe-area-inset-top))] pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:w-[22rem] md:w-[24rem] xl:hidden",
          "transform-gpu transition-transform duration-300 ease-out",
          open ? "translate-x-0" : "-translate-x-[105%]",
        ].join(" ")}
          aria-hidden={!open}
      >
        <div className="flex h-full min-h-0 flex-col">
          {/* Drawer header */}
          <div className="mb-3 flex shrink-0 items-center justify-between">
            <div className="font-semibold text-[var(--text-primary)]">Menu</div>
            <button
              aria-label="Close menu"
              className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-[var(--border)] bg-[var(--card)] text-[var(--text-secondary)] hover:bg-[var(--card-alt)]"
              onClick={() => setOpen(false)}
            >
              ✕
            </button>
          </div>

          <div className="min-h-0 flex-1">
            <SidebarCard onNavigate={() => setOpen(false)} />
          </div>
        </div>
      </div>
    </>
  );
}