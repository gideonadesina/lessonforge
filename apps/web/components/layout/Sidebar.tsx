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
  { href: "/school", label: "School", icon: School },
  { href: "/settings", label: "Settings", icon: Settings },
];

export default function Sidebar() {
  const pathname = usePathname();
  const supabase = createBrowserSupabase();

  const [profile, setProfile] = useState<Profile | null>(null);
  const [email, setEmail] = useState<string>("");
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    loadUser();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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

  return (
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
}
