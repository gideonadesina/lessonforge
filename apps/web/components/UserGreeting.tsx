"use client";

import { useEffect, useMemo, useState } from "react";
import { createBrowserSupabase } from "@/lib/supabase/browser";

export default function UserGreeting() {
  const supabase = useMemo(() => createBrowserSupabase(), []);
  const [name, setName] = useState("");

  useEffect(() => {
    async function load() {
      const { data: userData } = await supabase.auth.getUser();
      const user = userData?.user;
      if (!user) return;

      const { data } = await supabase
        .from("profiles")
        .select("full_name")
        .eq("id", user.id)
        .single();

      if (data?.full_name) {
        setName(data.full_name.split(" ")[0]);
      }
    }

    load();
  }, []);

  return (
    <span className="font-semibold">
      Welcome{ name ? `, ${name}` : "" } 👋
    </span>
  );
}
