"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createBrowserSupabase } from "@/lib/supabase/browser";

type ForgeGuideMessage = {
  role: "user" | "assistant";
  content: string;
};

type ForgeGuideContext = {
  page?: string;
  teacherName?: string;
  credits?: number;
  plan?: string;
  recentLessons?: any[];
  currentLesson?: any;
};

type ForgeGuideLauncherProps = {
  teacherName?: string | null;
  userEmail?: string | null;
};

export default function ForgeGuideLauncher({
  teacherName,
  userEmail,
}: ForgeGuideLauncherProps) {
  const supabase = useMemo(() => createBrowserSupabase(), []);
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [context, setContext] = useState<ForgeGuideContext>({});
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  const displayName =
    teacherName?.trim() || userEmail?.split("@")[0] || "Teacher";

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
    const ctx = (window as any).__FORGE_CONTEXT__;
    if (ctx) setContext(ctx);
  }, [open]);

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

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

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
          context,
          history: nextHistory.slice(-8),
        }),
      });

      const json = await res.json();
      console.log("ForgeGuide response:", json);

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
      console.error("ForgeGuide send error:", e);
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

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void sendMessage();
    }
  }

  return (
    <>
      {/* Floating launcher button */}
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="fixed bottom-5 right-5 z-50 flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 text-2xl text-white shadow-xl transition hover:scale-105"
        aria-label="Open ForgeGuide"
        title="Open ForgeGuide"
      >
        🧑🏽‍🏫
      </button>

      {open ? (
        <div className="fixed inset-0 z-[60] bg-black/40">
          <div className="absolute bottom-0 right-0 flex h-[88vh] w-full max-w-md flex-col border-l border-slate-200 bg-white shadow-2xl sm:bottom-4 sm:right-4 sm:h-[80vh] sm:rounded-3xl">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 text-lg text-white shadow-sm">
                  🧑🏽‍🏫
                </div>
                <div>
                  <div className="text-sm font-bold text-slate-900">
                    ForgeGuide
                  </div>
                  <div className="text-[11px] text-slate-500">
                    Teaching assistant
                  </div>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-800 hover:bg-slate-50"
              >
                Close
              </button>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-auto px-3 py-3">
              <div className="space-y-3">
                {messages.map((m, i) => (
                  <div
                    key={i}
                    className={
                      m.role === "assistant"
                        ? "mr-10 rounded-2xl bg-slate-100 px-3 py-3 text-sm leading-relaxed text-slate-800"
                        : "ml-10 rounded-2xl bg-violet-600 px-3 py-3 text-sm leading-relaxed text-white"
                    }
                  >
                    <div className="mb-1 text-[10px] font-semibold uppercase tracking-wide opacity-70">
                      {m.role === "assistant" ? "ForgeGuide" : "You"}
                    </div>
                    <div className="whitespace-pre-wrap">{m.content}</div>
                  </div>
                ))}

                {loading ? (
                  <div className="mr-10 rounded-2xl bg-slate-100 px-3 py-3 text-sm text-slate-600">
                    ForgeGuide is thinking…
                  </div>
                ) : null}

                <div ref={messagesEndRef} />
              </div>
            </div>

            {/* Composer */}
           <div className="border-t border-slate-200 p-3">
  {error ? (
    <div className="mb-3 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
      {error}
    </div>
  ) : null}

  <div className="flex items-center gap-2">
    <input
      value={input}
      onChange={(e) => setInput(e.target.value)}
      onKeyDown={handleKeyDown}
      placeholder="Ask ForgeGuide anything about teaching, lessons, or classroom ideas..."
      className="flex-1 rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-violet-400"
    />

    <button
      type="button"
      disabled={loading || !input.trim()}
      onClick={() => void sendMessage()}
      className="rounded-xl bg-violet-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-violet-700 disabled:opacity-60"
    >
      {loading ? "..." : "Send"}
    </button>
  </div>

  <div className="mt-2 text-[11px] text-slate-500">
    Ask about lesson improvement, teaching strategy, student engagement, or motivation.
  </div>
</div>
          </div>
        </div>
      ) : null}
    </>
  );
}