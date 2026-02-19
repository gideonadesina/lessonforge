"use client";

import { useEffect, useState } from "react";
import { createBrowserSupabase } from "@/lib/supabase/browser";

export default function SchoolAdminPage() {

  const [school, setSchool] = useState<any>(null);
  const [members, setMembers] = useState<any[]>([]);
  const [inviteCode, setInviteCode] = useState("");
  const [loading, setLoading] = useState(true);

  async function load() {

    const supabase = createBrowserSupabase();
    const { data } = await supabase.auth.getSession();

    const token = data.session?.access_token;

    const res = await fetch("/api/schools/admin", {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    const json = await res.json();

    setSchool(json.school);
    setMembers(json.members);
    setLoading(false);
  }

  async function generateInvite() {

    const supabase = createBrowserSupabase();
    const { data } = await supabase.auth.getSession();

    const token = data.session?.access_token;

    const res = await fetch("/api/schools/invite", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    const json = await res.json();

    setInviteCode(json.code);
  }

  useEffect(() => {
    load();
  }, []);

  if (loading) return <div>Loading...</div>;

  return (
    <div className="space-y-6">

      <h1 className="text-2xl font-bold">
        School Admin Dashboard
      </h1>

      <div className="bg-white p-4 rounded-xl border">
        <div>Name: {school.name}</div>
        <div>Seats used: {school.used_seats} / {school.max_seats}</div>
        <div>Plan: {school.plan}</div>
      </div>

      <div className="bg-white p-4 rounded-xl border">

        <button
          onClick={generateInvite}
          className="bg-indigo-600 text-white px-4 py-2 rounded"
        >
          Generate Invite Code
        </button>

        {inviteCode && (
          <div className="mt-2 font-bold">
            Invite Code: {inviteCode}
          </div>
        )}

      </div>

      <div className="bg-white p-4 rounded-xl border">

        <div className="font-semibold mb-2">
          Teachers
        </div>

        {members.map((m, i) => (
          <div key={i}>
            {m.user_id} — {m.role}
          </div>
        ))}

      </div>

    </div>
  );
}
