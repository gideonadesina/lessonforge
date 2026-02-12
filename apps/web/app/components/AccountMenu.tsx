"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { createClient } from "@/app/lib/supabase/browser";

type Profile = {
  full_name: string | null;
  avatar_url: string | null;
  email: string | null;
};

export default function AccountMenu() {
  const supabase = useMemo(() => createClient(), []);
  const [open, setOpen] = useState(false);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(false);

  // prevents setState after unmount
  const alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);

  // Load profile ONLY when dropdown opens (and only once)
  useEffect(() => {
    if (!open) return;
    if (profile) return; // already loaded

    (async () => {
      setLoading(true);
      try {
        const { data, error: userErr } = await supabase.auth.getUser();
        if (userErr) throw userErr;
        const user = data.user;
        if (!user) return;

        const { data: prof, error: profErr } = await supabase
          .from("profiles")
          .select("full_name, avatar_url, email")
          .eq("id", user.id)
          .single();

        if (profErr) throw profErr;

        if (alive.current) setProfile((prof as any) ?? null);
      } catch (err: any) {
        // ✅ ignore AbortError (happens in dev/fast refresh/navigation)
        if (err?.name === "AbortError") return;
        console.error("AccountMenu load profile error:", err);
      } finally {
        if (alive.current) setLoading(false);
      }
    })();
  }, [open, profile, supabase]);

  async function signOut() {
    try {
      await supabase.auth.signOut();
    } finally {
      window.location.href = "/";
    }
  }

  const initials = (profile?.full_name || profile?.email || "U")
    .trim()
    .slice(0, 1)
    .toUpperCase();

  const avatarSrc = profile?.avatar_url || "";

  return (
    <div className="relative">
      <button
  type="button"
  onClick={() => setOpen((v) => !v)}
  aria-label="Account menu"
  className="h-10 w-10 rounded-full border bg-white grid place-items-center hover:bg-slate-50 overflow-hidden"
>
  {avatarSrc ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={avatarSrc}
      alt="Avatar"
      className="h-full w-full object-cover"
    />
  ) : (
    <div className="h-full w-full bg-slate-900 text-white grid place-items-center text-sm font-semibold">
      {initials}
    </div>
  )}
</button>

      {open && (
        <div className="absolute right-0 mt-2 w-64 rounded-2xl border bg-white shadow-lg overflow-hidden z-50">
          <div className="px-4 py-3 border-b">
            <div className="text-sm font-semibold text-slate-900">
              {profile?.full_name || "Teacher"}
            </div>
            <div className="text-xs text-slate-500">{profile?.email || ""}</div>
          </div>

          <div className="p-2">
            <Link
              href="/account"
              className="block rounded-xl px-3 py-2 text-sm hover:bg-slate-50"
              onClick={() => setOpen(false)}
            >
              Account preferences
            </Link>

            <Link
              href="/account#avatar"
              className="block rounded-xl px-3 py-2 text-sm hover:bg-slate-50"
              onClick={() => setOpen(false)}
            >
              Change photo
            </Link>

            <button
              onClick={signOut}
              className="w-full text-left rounded-xl px-3 py-2 text-sm hover:bg-slate-50 text-red-600"
            >
              Log out
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
