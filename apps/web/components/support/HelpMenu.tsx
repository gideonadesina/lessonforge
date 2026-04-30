"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { FormEvent, useEffect, useRef, useState } from "react";
import {
  BookOpen,
  Bug,
  FileText,
  HelpCircle,
  LifeBuoy,
  Mail,
  Megaphone,
  Shield,
  X,
} from "lucide-react";
import { createBrowserSupabase } from "@/lib/supabase/browser";

const ISSUE_TYPES = [
  "General question",
  "Lesson generation issue",
  "Payment/billing issue",
  "School workspace issue",
  "Bug report",
  "Feature request",
];

type HelpMenuProps = {
  userEmail?: string | null;
  userId?: string | null;
  activeRole?: string | null;
  align?: "left" | "right";
};

export default function HelpMenu({
  userEmail,
  userId,
  activeRole,
  align = "right",
}: HelpMenuProps) {
  const pathname = usePathname();
  const supabase = createBrowserSupabase();
  const menuRef = useRef<HTMLDivElement | null>(null);
  const [open, setOpen] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [statusMessage, setStatusMessage] = useState("");
  const [form, setForm] = useState({
    name: "",
    email: userEmail ?? "",
    issueType: "General question",
    message: "",
  });

  useEffect(() => {
    setForm((current) => ({
      ...current,
      email: current.email || userEmail || "",
    }));
  }, [userEmail]);

  useEffect(() => {
    function onDocumentClick(event: MouseEvent) {
      const target = event.target as Node;
      if (menuRef.current && !menuRef.current.contains(target)) {
        setOpen(false);
      }
    }

    document.addEventListener("mousedown", onDocumentClick);
    return () => document.removeEventListener("mousedown", onDocumentClick);
  }, []);

  function openSupport(issueType = "General question") {
    setForm((current) => ({ ...current, issueType }));
    setStatus("idle");
    setStatusMessage("");
    setOpen(false);
    setModalOpen(true);
  }

  async function submitSupport(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus("sending");
    setStatusMessage("");

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      const token = session?.access_token ?? "";
      const res = await fetch("/api/support", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          ...form,
          metadata: {
            userId,
            userEmail,
            activeRole,
            pagePath: pathname,
            timestamp: new Date().toISOString(),
          },
        }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.ok) {
        setStatus("error");
        setStatusMessage(json?.message || "We could not send your message. Please try again.");
        return;
      }

      setStatus("sent");
      setStatusMessage(json.message || "Your message has been sent.");
      setForm((current) => ({ ...current, message: "" }));
    } catch {
      setStatus("error");
      setStatusMessage("We could not send your message. Please try again.");
    }
  }

  const itemClass =
    "flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm text-[var(--text-secondary)] transition hover:bg-[var(--card-alt)] hover:text-[var(--text-primary)]";

  return (
    <>
      <div ref={menuRef} className="relative">
        <button
          type="button"
          onClick={() => setOpen((current) => !current)}
          className="inline-flex items-center gap-2 rounded-xl border border-[var(--border)] bg-[var(--card)] px-3 py-2 text-sm font-semibold text-[var(--text-primary)] hover:bg-[var(--card-alt)]"
          aria-haspopup="menu"
          aria-expanded={open}
        >
          <HelpCircle className="h-4 w-4" />
          <span>Help</span>
        </button>

        {open ? (
          <div
            className={[
              "absolute z-50 mt-2 w-72 rounded-2xl border border-[var(--border)] bg-[var(--card)] p-2 shadow-xl",
              align === "right" ? "right-0" : "left-0",
            ].join(" ")}
            role="menu"
          >
            <Link href="/help" onClick={() => setOpen(false)} className={itemClass}>
              <BookOpen className="h-4 w-4" />
              Help Center
            </Link>
            <button type="button" onClick={() => openSupport("General question")} className={itemClass}>
              <Mail className="h-4 w-4" />
              Contact Support
            </button>
            <button type="button" onClick={() => openSupport("Bug report")} className={itemClass}>
              <Bug className="h-4 w-4" />
              Report a Bug
            </button>
            <Link href="/updates" onClick={() => setOpen(false)} className={itemClass}>
              <Megaphone className="h-4 w-4" />
              Release Notes
            </Link>
            <div className="my-1 border-t border-[var(--border)]" />
            <Link href="/terms" onClick={() => setOpen(false)} className={itemClass}>
              <FileText className="h-4 w-4" />
              Terms of Service
            </Link>
            <Link href="/privacy" onClick={() => setOpen(false)} className={itemClass}>
              <Shield className="h-4 w-4" />
              Privacy Policy
            </Link>
          </div>
        ) : null}
      </div>

      {modalOpen ? (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-lg rounded-2xl border border-[var(--border)] bg-[var(--card)] shadow-2xl">
            <div className="flex items-center justify-between border-b border-[var(--border)] px-5 py-4">
              <div className="flex items-center gap-3">
                <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-violet-100 text-violet-700">
                  <LifeBuoy className="h-4 w-4" />
                </span>
                <div>
                  <h2 className="text-base font-bold text-[var(--text-primary)]">Contact Support</h2>
                  <p className="text-xs text-[var(--text-secondary)]">support@lessonforge.app</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="inline-flex h-9 w-9 items-center justify-center rounded-xl text-[var(--text-secondary)] hover:bg-[var(--card-alt)]"
                aria-label="Close support form"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={submitSupport} className="space-y-4 px-5 py-5">
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="text-sm font-semibold text-[var(--text-primary)]">
                  Name
                  <input
                    value={form.name}
                    onChange={(e) => setForm((current) => ({ ...current, name: e.target.value }))}
                    className="mt-1 w-full rounded-xl border border-[var(--border)] bg-[var(--card-alt)] px-3 py-2 text-sm outline-none focus:border-violet-400"
                    placeholder="Your name"
                  />
                </label>
                <label className="text-sm font-semibold text-[var(--text-primary)]">
                  Email
                  <input
                    type="email"
                    required
                    value={form.email}
                    onChange={(e) => setForm((current) => ({ ...current, email: e.target.value }))}
                    className="mt-1 w-full rounded-xl border border-[var(--border)] bg-[var(--card-alt)] px-3 py-2 text-sm outline-none focus:border-violet-400"
                    placeholder="you@school.com"
                  />
                </label>
              </div>

              <label className="block text-sm font-semibold text-[var(--text-primary)]">
                Issue type
                <select
                  value={form.issueType}
                  onChange={(e) => setForm((current) => ({ ...current, issueType: e.target.value }))}
                  className="mt-1 w-full rounded-xl border border-[var(--border)] bg-[var(--card-alt)] px-3 py-2 text-sm outline-none focus:border-violet-400"
                >
                  {ISSUE_TYPES.map((issueType) => (
                    <option key={issueType} value={issueType}>
                      {issueType}
                    </option>
                  ))}
                </select>
              </label>

              <label className="block text-sm font-semibold text-[var(--text-primary)]">
                Message
                <textarea
                  required
                  minLength={10}
                  rows={6}
                  value={form.message}
                  onChange={(e) => setForm((current) => ({ ...current, message: e.target.value }))}
                  className="mt-1 w-full resize-none rounded-xl border border-[var(--border)] bg-[var(--card-alt)] px-3 py-2 text-sm outline-none focus:border-violet-400"
                  placeholder="Tell us what happened."
                />
              </label>

              {statusMessage ? (
                <div
                  className={[
                    "rounded-xl border px-3 py-2 text-sm",
                    status === "sent"
                      ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                      : "border-rose-200 bg-rose-50 text-rose-700",
                  ].join(" ")}
                >
                  {statusMessage}
                </div>
              ) : null}

              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="rounded-xl border border-[var(--border)] px-4 py-2 text-sm font-semibold text-[var(--text-primary)] hover:bg-[var(--card-alt)]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={status === "sending"}
                  className="rounded-xl bg-violet-600 px-4 py-2 text-sm font-semibold text-white hover:bg-violet-700 disabled:opacity-60"
                >
                  {status === "sending" ? "Sending..." : "Send message"}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </>
  );
}
