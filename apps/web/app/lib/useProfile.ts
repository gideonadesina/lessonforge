"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createClient } from "@/app/lib/supabase/browser";

export type Profile = {
  full_name: string | null;
  avatar_url: string | null;
  email: string | null;
};

export function useProfile() {
  const supabase = useMemo(() => createClient(), []);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const alive = useRef(true);

  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const { data, error: userErr } = await supabase.auth.getUser();
        if (userErr) throw userErr;

        const user = data.user;
        if (!user) {
          if (alive.current) setProfile(null);
          return;
        }

        const { data: prof, error: profErr } = await supabase
          .from("profiles")
          .select("full_name, avatar_url, email")
          .eq("id", user.id)
          .single();

        if (profErr) throw profErr;

        if (alive.current) setProfile((prof as any) ?? null);
      } catch (err: any) {
        // ignore AbortError noise in dev
        if (err?.name !== "AbortError") console.error("useProfile error:", err);
      } finally {
        if (alive.current) setLoading(false);
      }
    })();
  }, [supabase]);

  return { profile, loading };
}
