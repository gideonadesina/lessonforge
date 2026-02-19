"use client";

import { useEffect, useMemo, useState } from "react";
import { createBrowserSupabase } from "@/lib/supabase/browser";
import SchoolCodeInput from "@/components/SchoolCodeInput";

type MeResponse = {
  ok: boolean;
  data?: {
    user: { id: string; email: string | null };
    membership: null | { school_id: string; role: string; joined_at: string | null };
    school: null | { id: string; name: string | null; code?: string | null; created_at?: string | null };
    license: null | {
      id: string;
      school_id: string;
      seats_total: number | null;
      seats_used: number | null;
      status: string | null;
      expires_at: string | null;
      created_at: string | null;
    };
  };
  error?: string;
};

function timeAgo(iso?: string | null) {
  if (!iso) return "";
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return "";
  const diff = Date.now() - t;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

export default function SchoolPage() {
  const supabase = useMemo(() => createBrowserSupabase(), []);

  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [me, setMe] = useState<MeResponse["data"] | null>(null);

  async function getToken() {
    const { data } = await supabase.auth.getSession();
    return data.session?.access_token ?? "";
  }

  async function loadMe() {
    setLoading(true);
    setErr(null);
    try {
      const token = await getToken();
      if (!token) throw new Error("Not logged in");

      const res = await fetch("/api/schools/me", {
        method: "GET",
        headers: { Authorization: `Bearer ${token}` },
      });

      const json = (await res.json()) as MeResponse;

      if (!res.ok || !json.ok) {
        throw new Error(json?.error || "Failed to load school info");
      }

      setMe(json.data ?? null);
    } catch (e: any) {
      setErr(e?.message || "Failed to load");
      setMe(null);
    } finally {
      setLoading(false);
    }
  }

  async function leaveSchool() {
    const ok = confirm("Leave this school license? You will lose access to school-only features.");
    if (!ok) return;

    setBusy(true);
    setErr(null);

    try {
      const token = await getToken();
      if (!token) throw new Error("Not logged in");

      const res = await fetch("/api/schools/leave", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });

      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || "Failed to leave school");

      await loadMe();
    } catch (e: any) {
      setErr(e?.message || "Failed");
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    loadMe();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const membership = me?.membership ?? null;
  const school = me?.school ?? null;
  const license = me?.license ?? null;

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">School</h1>
          <p className="mt-1 text-sm text-slate-600">Manage your school membership & license access.</p>
        </div>

        <div className="flex gap-2">
          <button
            onClick={loadMe}
            disabled={loading}
            className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-800 hover:bg-slate-100 disabled:opacity-60"
          >
            {loading ? "Loading..." : "Refresh"}
          </button>

          {school ? (
            <button
              onClick={leaveSchool}
              disabled={busy}
              className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm font-semibold text-red-700 hover:bg-red-100 disabled:opacity-60"
            >
              {busy ? "Leaving..." : "Leave school"}
            </button>
          ) : null}
        </div>
      </div>

      {err ? (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{err}</div>
      ) : null}

      {loading ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-6 text-sm text-slate-600">
          Loading school info...
        </div>
      ) : null}

      {/* If no school */}
      {!loading && !school ? (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="text-sm font-semibold text-slate-900">Not joined yet</div>
            <p className="mt-2 text-sm text-slate-700 leading-relaxed">
              If your headteacher purchased a school license, they will share a code with teachers. Enter it below to
              join the school workspace.
            </p>

            <div className="mt-4">
              <SchoolCodeInput />
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="text-sm font-semibold text-slate-900">How it works</div>
            <ul className="mt-3 space-y-2 text-sm text-slate-700 list-disc pl-5">
              <li>Headteacher buys a license (seats = number of teachers).</li>
              <li>Teachers enter the shared code to activate.</li>
              <li>Access is monthly and managed by the school.</li>
            </ul>

            <div className="mt-4 rounded-xl bg-slate-50 p-3 text-xs text-slate-600">
              Tip: If you don’t have a code, ask your admin or continue with individual subscriptions.
            </div>
          </div>
        </div>
      ) : null}

      {/* If joined */}
      {!loading && school ? (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          {/* School card */}
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm lg:col-span-2">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="text-xs text-slate-500">School</div>
                <div className="mt-1 text-xl font-extrabold text-slate-900">{school.name || "Unnamed School"}</div>

                <div className="mt-2 flex flex-wrap gap-2">
                  <span className="rounded-full bg-violet-50 px-3 py-1 text-xs font-semibold text-violet-700">
                    Role: {membership?.role ?? "teacher"}
                  </span>

                  {membership?.joined_at ? (
                    <span className="rounded-full bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-700">
                      Joined {timeAgo(membership.joined_at)}
                    </span>
                  ) : null}

                  {license?.status ? (
                    <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
                      License: {license.status}
                    </span>
                  ) : null}
                </div>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm">
                <div className="text-xs text-slate-500">Your account</div>
                <div className="mt-1 font-semibold text-slate-900">{me?.user.email ?? "—"}</div>
              </div>
            </div>

            <div className="mt-4 rounded-xl bg-slate-50 p-3 text-xs text-slate-600">
              School license access is managed by your admin. If your seat is revoked, you’ll return to individual mode.
            </div>
          </div>

          {/* License card */}
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="text-sm font-semibold text-slate-900">License seats</div>

            <div className="mt-3 space-y-2 text-sm text-slate-700">
              <div className="flex items-center justify-between">
                <span>Total seats</span>
                <span className="font-semibold">{license?.seats_total ?? "—"}</span>
              </div>
              <div className="flex items-center justify-between">
                <span>Used seats</span>
                <span className="font-semibold">{license?.seats_used ?? "—"}</span>
              </div>
              <div className="flex items-center justify-between">
                <span>Expiry</span>
                <span className="font-semibold">
                  {license?.expires_at ? new Date(license.expires_at).toLocaleDateString() : "—"}
                </span>
              </div>
            </div>

            <div className="mt-4 rounded-xl border border-slate-200 bg-white p-3 text-xs text-slate-600">
              If this is wrong, contact the school admin to update seats.
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
