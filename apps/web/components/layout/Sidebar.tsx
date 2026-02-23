"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { createBrowserSupabase } from "@/lib/supabase/browser";
import {
  LayoutDashboard,
  Sparkles,
  Library,
  FileText,
  ClipboardList,
  School,
  Settings,
} from "lucide-react";

type Profile = {
  full_name?: string | null;
  avatar_url?: string | null;
};

const nav = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/generate", label: "Generate", icon: Sparkles },
  { href: "/library", label: "Library", icon: Library },
  { href: "/worksheets", label: "Worksheets", icon: FileText },
  // ✅ FIXED: remove space/caps so it matches your actual route
  { href: "/exam-builder", label: "Exam Builder", icon: ClipboardList },
  { href: "/school", label: "School", icon: School },
  { href: "/settings", label: "Settings", icon: Settings },
];

export default function Sidebar() {
  const pathname = usePathname();
  const supabase = createBrowserSupabase();

  const [profile, setProfile] = useState<Profile | null>(null);
  const [email, setEmail] = useState<string>("");
  const [uploading, setUploading] = useState(false);

  // Drawer state (mobile/tablet)
  const [open, setOpen] = useState(false);

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

      await supabase
        .from("profiles")
        .update({ avatar_url: url })
        .eq("id", user.id);

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

  // ---- Your existing sidebar UI (UNCHANGED) ----
  const SidebarCard = ({ onNavigate }: { onNavigate?: () => void }) => (
    <aside className="h-full rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      {/* User */}
      <div className="flex items-center gap-3 pb-4 border-b border-slate-200">
        <label className="relative cursor-pointer">
          <img
            src={avatar}
            alt="avatar"
            className="h-12 w-12 rounded-full border border-slate-200 object-cover"
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
          <div className="truncate text-sm font-semibold text-slate-900">
            {profile?.full_name || "Your Name"}
          </div>
          <div className="truncate text-xs text-slate-500">{email}</div>
          <div className="text-[11px] text-slate-400">
            {uploading ? "Uploading..." : "Click photo to change"}
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav className="mt-4 flex flex-col gap-1">
        {nav.map((item) => {
          const active = pathname === item.href;
          const Icon = item.icon;

          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onNavigate}
              className={[
                "flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium transition",
                active
                  ? "bg-violet-50 text-violet-700 border border-violet-100"
                  : "text-slate-700 hover:bg-slate-50",
              ].join(" ")}
            >
              <Icon className="h-4 w-4" />
              {item.label}
            </Link>
          );
        })}
      </nav>

      {/* Tip box */}
      <div className="mt-5 rounded-2xl border border-slate-200 bg-slate-50 p-4">
        <div className="text-xs font-semibold text-slate-900">Tip</div>
        <p className="mt-1 text-xs text-slate-600 leading-relaxed">
          Use keywords like <b>WAEC / NECO / Cambridge</b> when generating.
        </p>
      </div>
    </aside>
  );

  return (
    <>
      {/* Mobile + Tablet top bar (shows below lg) */}
      <div className="sticky top-0 z-40 flex items-center gap-3 border-b bg-white/90 backdrop-blur px-4 py-3 lg:hidden">
        <button
          aria-label="Open menu"
          className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-white"
          onClick={() => setOpen(true)}
        >
          <span className="text-xl leading-none">☰</span>
        </button>

        <div className="font-semibold text-slate-900">LessonForge</div>
      </div>

      {/* Desktop sidebar (lg+) fixed left */}
      <div className="hidden lg:block">
        <div className="fixed inset-y-0 left-0 z-30 w-80 p-4">
          <SidebarCard />
        </div>
      </div>

      {/* Mobile/Tablet overlay */}
      {open && (
        <button
          aria-label="Close menu overlay"
          className="fixed inset-0 z-40 bg-black/30 lg:hidden"
          onClick={() => setOpen(false)}
        />
      )}

      {/* Mobile/Tablet drawer */}
      <div
        className={[
          "fixed inset-y-0 left-0 z-50 w-[86vw] max-w-[360px] p-4 lg:hidden",
          "transition-transform duration-200 ease-out",
          open ? "translate-x-0" : "-translate-x-full",
        ].join(" ")}
      >
        {/* Drawer header */}
        <div className="mb-3 flex items-center justify-between">
          <div className="font-semibold text-slate-900">Menu</div>
          <button
            aria-label="Close menu"
            className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-white"
            onClick={() => setOpen(false)}
          >
            ✕
          </button>
        </div>

        <SidebarCard onNavigate={() => setOpen(false)} />
      </div>
    </>
  );
}