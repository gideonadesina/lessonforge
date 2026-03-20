"use client";

import { useEffect, useMemo, useState } from "react";
import { createBrowserSupabase } from "@/lib/supabase/browser";

type ForgeGuideMessage = {
  role: "user" | "assistant";
  content: string;
};

type ForgeGuideProps = {
  teacherName?: string | null;
  userEmail?: string | null;
  pageContext?: string;
  lessonContext?: any;
};

const QUICK_ACTIONS = [
  "Motivate me for today’s classes",
  "Suggest a strong teaching tip for this week",
  "How can I engage weak students better?",
  "Give me a practical classroom activity idea",
];

export default function ForgeGuide({
  teacherName,
  userEmail,
  pageContext = "dashboard",
  lessonContext = null,
}: ForgeGuideProps) {
  const supabase = useMemo(() => createBrowserSupabase(), []);
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const displayName =
    teacherName?.trim() ||
    userEmail?.split("@")[0] ||
    "Teacher";

  const [messages, setMessages] = useState<ForgeGuideMessage[]>([
    {
      role: "assistant",
      content: `Welcome back, ${displayName} 👋

I’m ForgeGuide — your LessonForge teaching assistant.

I can help you with teaching advice, lesson improvement ideas, classroom strategies, and encouragement.

What would you like help with today?`,
    },
  ]);

  useEffect(() => {
    setMessages([
      {
        role: "assistant",
        content: `Welcome back, ${displayName} 👋

I’m ForgeGuide — your LessonForge teaching assistant.

I can help you with teaching advice, lesson improvement ideas, classroom strategies, and encouragement.

What would you like help with today?`,
      },
    ]);
  }, [displayName]);

  async function sendMessage(messageText?: string) {
    const text = (messageText ?? input).trim();
    if (!text || loading) return;

    setError(null);

    const nextUserMessage: ForgeGuideMessage = {
      role: "user",
      content: text,
    };

    const nextHistory = [...messages, nextUserMessage];
    setMessages(nextHistory);
    setInput("");
    setLoading(true);

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session?.access_token) {
        throw new Error("Session expired. Please login again.");
      }

      const res = await fetch("/api/forgeguide/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          message: text,
          teacherName: displayName,
          userEmail,
          pageContext,
          lessonContext,
          history: nextHistory.slice(-8),
        }),
      });

      const json = await res.json();

      if (!res.ok) {
        throw new Error(json?.error || json?.message || "ForgeGuide failed");
      }

      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: json.reply,
        },
      ]);
    } catch (e: any) {
      setError(e?.message || "Something went wrong");
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content:
            "I’m sorry — I couldn’t respond just now. Please try again in a moment.",
        },
      ]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-start gap-4">
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 text-2xl shadow-md">
          🙂
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
            <div>
              <div className="text-2xl font-bold tracking-tight text-slate-900">
                ForgeGuide
              </div>
              <div className="mt-1 text-sm text-slate-600">
                Your personal teaching companion
              </div>
            </div>

            <button
              type="button"
              onClick={() => setOpen((v) => !v)}
              className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-800 hover:bg-slate-50"
            >
              {open ? "Hide ForgeGuide" : "Open ForgeGuide"}
            </button>
          </div>

          <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <div className="text-sm font-semibold text-slate-900">
              Welcome back, {displayName}
            </div>
            <p className="mt-2 text-sm leading-relaxed text-slate-700">
              Teaching is meaningful work. Even the lessons that feel small can
              make a lasting difference in your students. I’m here to help you
              teach with more clarity, confidence, and calm.
            </p>

            <div className="mt-4 flex flex-wrap gap-2">
              {QUICK_ACTIONS.map((item) => (
                <button
                  key={item}
                  type="button"
                  onClick={() => {
                    setOpen(true);
                    void sendMessage(item);
                  }}
                  className="rounded-full border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100"
                >
                  {item}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {open ? (
        <div className="mt-5 rounded-2xl border border-slate-200 bg-slate-50 p-4">
          <div className="max-h-[420px] space-y-3 overflow-auto pr-1">
            {messages.map((m, i) => (
              <div
                key={i}
                className={
                  m.role === "assistant"
                    ? "mr-8 rounded-2xl border border-slate-200 bg-white p-4 text-sm leading-relaxed text-slate-800"
                    : "ml-8 rounded-2xl bg-violet-600 p-4 text-sm leading-relaxed text-white"
                }
              >
                <div className="mb-1 text-[11px] font-semibold uppercase tracking-wide opacity-70">
                  {m.role === "assistant" ? "ForgeGuide" : "You"}
                </div>
                <div className="whitespace-pre-wrap">{m.content}</div>
              </div>
            ))}

            {loading ? (
              <div className="mr-8 rounded-2xl border border-slate-200 bg-white p-4 text-sm text-slate-600">
                ForgeGuide is thinking…
              </div>
            ) : null}
          </div>

          {error ? (
            <div className="mt-3 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
              {error}
            </div>
          ) : null}

          <div className="mt-4 flex flex-col gap-3">
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask ForgeGuide anything about teaching, motivation, student engagement, or lesson improvement..."
              rows={4}
              className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:border-violet-400"
            />

            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => void sendMessage("Give me a practical teaching suggestion for today.")}
                  className="rounded-full border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100"
                >
                  Practical tip
                </button>

                <button
                  type="button"
                  onClick={() => void sendMessage("Encourage me for today’s class.")}
                  className="rounded-full border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100"
                >
                  Encourage me
                </button>
              </div>

              <button
                type="button"
                disabled={loading || !input.trim()}
                onClick={() => void sendMessage()}
                className="rounded-xl bg-violet-600 px-5 py-2 text-sm font-semibold text-white shadow-sm hover:bg-violet-700 disabled:opacity-60"
              >
                {loading ? "Sending..." : "Ask ForgeGuide"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}