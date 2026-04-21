"use client";

import { useEffect, useState } from "react";

type TipInput = {
  topic: string;
  class_name: string;
  subject: string;
};

function getFallbackText() {
  return "Start with a real-world example your students can relate to before introducing the formal concept.";
}

async function getAccessToken() {
  const { createBrowserSupabase } = await import("@/lib/supabase/browser");
  const supabase = createBrowserSupabase();
  const {
    data: { session },
  } = await supabase.auth.getSession();
  return session?.access_token ?? "";
}

export default function ForgeGuideTipCard({ tipInput }: { tipInput: TipInput | null }) {
  const [tip, setTip] = useState<string>(getFallbackText());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;

    async function loadTip() {
      if (!tipInput?.topic || !tipInput?.class_name || !tipInput?.subject) {
        setTip(getFallbackText());
        setError(null);
        return;
      }

      setLoading(true);
      setError(null);

      try {
        const token = await getAccessToken();
        if (!token) {
          throw new Error("Unauthorized");
        }

        const res = await fetch("/api/ai/teaching-tip", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(tipInput),
          cache: "no-store",
        });
        const json = await res.json();

        if (!res.ok || !json?.ok) {
          throw new Error(json?.error ?? "Failed to fetch teaching tip");
        }

        const nextTip = String(json?.data?.tip ?? "").trim() || getFallbackText();
        if (alive) {
          setTip(nextTip);
          setError(null);
        }
      } catch (err: unknown) {
        if (alive) {
          setTip(getFallbackText());
          setError(err instanceof Error ? err.message : "Failed to fetch teaching tip");
        }
      } finally {
        if (alive) setLoading(false);
      }
    }

    void loadTip();
    return () => {
      alive = false;
    };
  }, [tipInput?.topic, tipInput?.class_name, tipInput?.subject]);

  return (
    <section className="rounded-xl border border-[#5DCAA5] bg-[#E1F5EE] p-4">
      <div className="flex items-start gap-3">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#1D9E75]">
          <svg
            viewBox="0 0 24 24"
            fill="none"
            aria-hidden="true"
            className="h-4 w-4 text-white"
          >
            <path
              d="M12 3l2.1 4.26 4.7.68-3.4 3.3.8 4.67L12 13.7 7.8 15.9l.8-4.67-3.4-3.3 4.7-.68L12 3z"
              fill="currentColor"
            />
          </svg>
        </div>

        <div className="min-w-0">
          <p className="text-[9px] uppercase tracking-wide text-[#0F6E56]">
            ForgeGuide · Teaching tip matched to today
          </p>
          <p className="mt-1 text-[13px] font-semibold text-[#085041]">
            {loading ? "Loading teaching tip..." : tip}
          </p>
          <p className="mt-1 text-[11px] text-[#0F6E56]">
            {error
              ? "Showing fallback guidance while the tip service recovers."
              : "Practical support tailored for your next class topic."}
          </p>
        </div>
      </div>
    </section>
  );
}
