"use client";

import { useMemo, useState } from "react";
import { createBrowserSupabase } from "@/lib/supabase/browser";
import { track } from "@/lib/analytics";

type JoinedData = {
  school: {
    id: string;
    name: string | null;
    code: string | null;
  };
  membership: {
    role: string;
    joined_at: string | null;
  };
};

type SchoolCodeInputProps = {
  onJoined?: (data: JoinedData) => void | Promise<void>;
};

export default function SchoolCodeInput({ onJoined }: SchoolCodeInputProps) {
  const supabase = useMemo(() => createBrowserSupabase(), []);
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function joinSchool() {
    const cleaned = code.trim().toUpperCase();
    if (!cleaned) return;
    setLoading(true);
    setError(null);

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      const token = session?.access_token;
      if (!token) {
        setError("Session expired. Please log in again.");
        return;
      }

      const res = await fetch("/api/schools/join", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ code: cleaned }),
      });

      const json = await res.json();

      if (!res.ok || json?.ok === false) {
        const msg = json?.error ?? "Invalid school code";
        if (msg.toLowerCase().includes("invalid")) {
          setError("Invalid school code — check with your principal");
        } else if (msg.toLowerCase().includes("full")) {
          setError("This school is currently unavailable. Ask your principal to confirm the school code.");
        } else if (msg.toLowerCase().includes("principal")) {
          setError("Principal accounts cannot join a school as a teacher.");
        } else if (msg.toLowerCase().includes("inactive") || msg.toLowerCase().includes("active")) {
          setError("This school's plan is no longer active. Ask your principal to renew.");
        } else {
          setError(msg);
        }
        return;
      }

      const joinedData = json.data as JoinedData;
      track("teacher_joined_school", {
        user_role: "teacher",
        active_role: "teacher",
        school_id: joinedData.school.id,
        school_name: joinedData.school.name,
        credit_source: "school",
      });
      await onJoined?.(joinedData);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-col gap-1">
        <label className="text-xs font-medium text-slate-700">
          School code
        </label>
        <input
          value={code}
          onChange={(e) => setCode(e.target.value.toUpperCase())}
          onKeyDown={(e) => { if (e.key === "Enter") void joinSchool(); }}
          placeholder="e.g. FRG-7X2M"
          maxLength={20}
          className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 placeholder-slate-400 focus:border-[#534AB7] focus:outline-none"
        />
        <span className="text-[11px] text-slate-500">
          Ask your principal for your school code
        </span>
      </div>

      {error ? (
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {error}
        </div>
      ) : null}

      <button
        type="button"
        onClick={() => void joinSchool()}
        disabled={loading || !code.trim()}
        className="w-full rounded-xl bg-[#534AB7] py-3 text-sm font-medium text-white hover:bg-[#3C3489] disabled:opacity-60"
      >
        {loading ? "Joining..." : "Join school"}
      </button>
    </div>
  );
}
