"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createBrowserSupabase } from "@/lib/supabase/browser";
import SchoolCodeInput from "@/components/SchoolCodeInput";

type SchoolData = {
  id: string;
  name: string | null;
  code: string | null;
  created_at: string | null;
};

type MembershipData = {
  school_id: string;
  role: string;
  joined_at: string | null;
};

type LicenseData = {
  seats_total: number | null;
  seats_used: number | null;
  status: string | null;
} | null;

type MeResponse = {
  user: { id: string; email: string | null };
  membership: MembershipData | null;
  school: SchoolData | null;
  license: LicenseData;
};

type JoinedSchool = {
  id: string;
  name: string | null;
  code: string | null;
};

function SchoolIcon() {
  return (
    <svg
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="#534AB7"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M3 21h18M9 21V9.6L12 7l3 2.6V21M5 21V12l7-5 7 5v9" />
      <rect x="10" y="14" width="4" height="7" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg
      width="28"
      height="28"
      viewBox="0 0 28 28"
      fill="none"
    >
      <circle cx="14" cy="14" r="13" stroke="#534AB7" strokeWidth="1.5" />
      <path
        d="M8 14l4 4 8-8"
        stroke="#534AB7"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export default function SchoolPage() {
  const router = useRouter();
  const supabase = useMemo(() => createBrowserSupabase(), []);

  const [loading, setLoading] = useState(true);
  const [meData, setMeData] = useState<MeResponse | null>(null);
  const [justJoined, setJustJoined] = useState<JoinedSchool | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function loadMe() {
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      const token = session?.access_token;
      if (!token) {
        router.replace("/login");
        return;
      }

      const res = await fetch("/api/schools/me", {
        headers: { Authorization: `Bearer ${token}` },
        cache: "no-store",
      });

      const json = await res.json();
      if (!res.ok || !json?.ok) {
        setError(json?.error ?? "Failed to load school info");
        return;
      }

      setMeData(json.data as MeResponse);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadMe();
  }, []);

  if (loading) {
    return (
      <div className="flex min-h-[300px] items-center justify-center">
        <div className="text-sm text-slate-500">Loading...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="mx-auto max-w-md rounded-2xl border border-rose-200 bg-rose-50 p-6 text-sm text-rose-700">
        {error}
      </div>
    );
  }

  const isInSchool = Boolean(meData?.membership?.school_id);

  if (justJoined) {
    return (
      <div className="mx-auto max-w-[480px] px-4 py-8">
        <div className="rounded-2xl border border-slate-200 bg-white p-8">
          <div className="mb-5 flex justify-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-[#EEEDFE]">
              <CheckIcon />
            </div>
          </div>
          <h1 className="mb-2 text-center text-[22px] font-medium text-slate-900">
            You have joined {justJoined.name ?? "your school"}
          </h1>
          <p className="mb-6 text-center text-[13px] text-slate-600">
            You now have access to your school&apos;s shared credits. Your
            dashboard will reflect your school plan.
          </p>

          <div className="mb-4 rounded-xl border border-[#AFA9EC] bg-[#EEEDFE] px-4 py-3">
            <div className="text-[11px] font-medium uppercase tracking-wide text-[#534AB7]">
              What this means for you
            </div>
            <ul className="mt-2 space-y-1.5">
              {[
                "Generate lessons using your school's shared credits",
                "Your principal manages billing — no personal payment needed",
                "Credits are shared across all teachers in your school",
              ].map((item) => (
                <li key={item} className="flex items-start gap-2 text-[12px] text-[#3C3489]">
                  <span className="mt-0.5 text-[#534AB7]">✓</span>
                  {item}
                </li>
              ))}
            </ul>
          </div>

          <button
            type="button"
            onClick={() => router.push("/dashboard")}
            className="w-full rounded-xl bg-[#534AB7] py-3 text-sm font-medium text-white hover:bg-[#3C3489]"
          >
            Go to dashboard
          </button>
        </div>
      </div>
    );
  }

  if (isInSchool && meData?.school) {
    const school = meData.school;
    const membership = meData.membership;
    const license = meData.license;
    const seatsTotal = license?.seats_total ?? null;
    const seatsUsed = license?.seats_used ?? null;

    return (
      <div className="mx-auto max-w-[480px] px-4 py-8">
        <div className="rounded-2xl border border-slate-200 bg-white p-6">
          <div className="mb-4 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#EEEDFE]">
              <SchoolIcon />
            </div>
            <div>
              <h1 className="text-[18px] font-medium text-slate-900">
                {school.name ?? "Your school"}
              </h1>
              <span className="inline-flex items-center rounded-full bg-[#EEEDFE] px-3 py-0.5 text-[11px] font-medium text-[#3C3489]">
                School plan
              </span>
            </div>
          </div>

          <div className="mb-4 rounded-xl bg-slate-50 px-4 py-4">
            <div className="mb-1 text-[11px] font-medium uppercase tracking-wide text-slate-500">
              School credits
            </div>
            <div className="text-[22px] font-medium text-slate-900">
              Managed by your principal
            </div>
            <div className="mt-1 text-[12px] text-slate-500">
              Credits are shared across your school
            </div>
            <div className="mt-0.5 text-[12px] text-slate-500">
              Your principal manages billing and credits
            </div>
          </div>

          <div className="divide-y divide-slate-100 rounded-xl border border-slate-200">
            <div className="flex items-center justify-between px-4 py-3">
              <span className="text-[13px] text-slate-600">Your role</span>
              <span className="text-[13px] font-medium capitalize text-slate-900">
                {membership?.role ?? "Teacher"}
              </span>
            </div>
            {seatsTotal !== null ? (
              <div className="flex items-center justify-between px-4 py-3">
                <span className="text-[13px] text-slate-600">Teachers</span>
                <span className="text-[13px] font-medium text-slate-900">
                  {seatsUsed ?? "—"} / {seatsTotal}
                </span>
              </div>
            ) : null}
            {membership?.joined_at ? (
              <div className="flex items-center justify-between px-4 py-3">
                <span className="text-[13px] text-slate-600">Joined</span>
                <span className="text-[13px] font-medium text-slate-900">
                  {new Date(membership.joined_at).toLocaleDateString("en-GB", {
                    day: "numeric",
                    month: "short",
                    year: "numeric",
                  })}
                </span>
              </div>
            ) : null}
          </div>

          <p className="mt-4 text-center text-[11px] text-slate-400">
            To leave this school or report an issue, contact your principal
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-[480px] px-4 py-8">
      <div className="rounded-2xl border border-slate-200 bg-white p-8">
        <div className="mb-5 flex justify-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[#EEEDFE]">
            <SchoolIcon />
          </div>
        </div>

        <h1 className="mb-2 text-center text-[20px] font-medium text-slate-900">
          Join your school
        </h1>
        <p className="mb-6 text-center text-[13px] text-slate-600">
          Your school is on LessonForge. Enter your school code to access
          shared credits and start generating lessons.
        </p>

        <SchoolCodeInput
          onJoined={(data) => {
            setJustJoined(data.school);
          }}
        />

        <div className="mt-6 rounded-xl border border-slate-100 bg-slate-50 px-4 py-3">
          <div className="text-[11px] font-medium text-slate-700">
            What happens after joining?
          </div>
          <ul className="mt-2 space-y-1.5">
            {[
              "Your dashboard switches to school plan",
              "You use your school's shared credits",
              "Your principal handles all billing",
            ].map((item) => (
              <li
                key={item}
                className="flex items-center gap-2 text-[11px] text-slate-600"
              >
                <span className="text-[#534AB7]">→</span>
                {item}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}