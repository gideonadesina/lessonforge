"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { ArrowUpRight, BookOpen, FileText, LifeBuoy, Newspaper, ShieldCheck } from "lucide-react";
import { createBrowserSupabase } from "@/lib/supabase/browser";
import { useProfile } from "@/lib/useProfile";

type QuickLink = {
  label: string;
  href?: string;
  external?: boolean;
  onClick?: () => void;
  icon: typeof BookOpen;
};

const quickLinks: QuickLink[] = [
  {
    label: "Help Center",
    href: "/help/center",
    icon: LifeBuoy,
  },
  {
    label: "Release Notes",
    icon: Newspaper,
  },
  {
    label: "Terms of Service",
    href: "/terms",
    icon: FileText,
  },
  {
    label: "Privacy Policy",
    href: "/privacy",
    icon: ShieldCheck,
  },
  {
    label: "Blog pages",
    href: "/blog",
    icon: BookOpen,
  },
];

const updates = [
  {
    version: "Version 2.1 - April 2026",
    items: [
      "Gamma-level lesson slide redesign with beautiful templates for each slide type",
      "Real PDF export for lesson slides",
      "School payment flow fully working",
      "Professional email notification system",
      "Editable lesson output for all sections",
      "New blog and SEO landing pages",
      "Exam builder with Word document export",
      "Enhanced principal analytics dashboard",
      "Mobile UI improvements across all pages",
    ],
  },
  {
    version: "Version 2.0 - March 2026",
    items: [
      "Principal dashboard and school workspace",
      "School credits pool for unlimited teachers",
      "Lesson slides with Pexels image integration",
      "Worksheet generator",
      "Exam builder",
      "Library with saved lessons",
    ],
  },
  {
    version: "Version 1.0 - January 2026",
    items: [
      "Initial launch",
      "Lesson plan and notes generator",
      "WAEC and NERDC curriculum support",
      "Nigerian teacher focused AI generation",
    ],
  },
];

function getFirstName(name: string) {
  const first = name.trim().split(/\s+/)[0];
  return first || "there";
}

export default function HelpPage() {
  const router = useRouter();
  const supabase = useMemo(() => createBrowserSupabase(), []);
  const { profile } = useProfile();
  const [releaseNotesOpen, setReleaseNotesOpen] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!profile) return;

    setName((current) => current || profile.full_name || profile.email?.split("@")[0] || "");
    setEmail((current) => current || profile.email || "");
  }, [profile]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");

    const trimmedName = name.trim();
    const trimmedEmail = email.trim();
    const trimmedMessage = message.trim();

    if (!trimmedName || !trimmedEmail || !trimmedMessage) {
      setError("Please fill in all fields.");
      return;
    }

    setSubmitting(true);

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      const response = await fetch("/api/help", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}),
        },
        body: JSON.stringify({
          name: trimmedName,
          email: trimmedEmail,
          message: trimmedMessage,
          userId: profile?.id ?? null,
          plan: profile?.plan ?? "free",
        }),
      });

      const json = (await response.json().catch(() => null)) as { ok?: boolean; message?: string } | null;

      if (!response.ok || !json?.ok) {
        setError(json?.message || "We could not send your message right now. Please try again.");
        return;
      }

      setDone(true);
      router.refresh();
    } catch {
      setError("We could not send your message right now. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  const firstName = getFirstName(name || profile?.full_name || profile?.email || "LessonForge user");

  return (
    <div className="space-y-8">
      <header className="space-y-2">
        <h1 className="text-3xl font-bold text-[var(--text-primary)]">How can we help?</h1>
        <p className="text-sm text-[var(--text-secondary)]">We typically respond within 24 hours.</p>
      </header>

      <section className="overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--card)] shadow-sm">
        {quickLinks.map((item) => {
          const Icon = item.icon;

          if (item.label === "Release Notes") {
            return (
              <button
                key={item.label}
                type="button"
                onClick={() => setReleaseNotesOpen(true)}
                className="flex w-full items-center justify-between border-b border-[#f3f4f6] px-4 py-[14px] text-left transition hover:bg-[#f9f8ff]"
              >
                <span className="flex items-center gap-3">
                  <Icon className="h-5 w-5 text-[#6C63FF]" />
                  <span className="text-[15px] text-[#1a1a2e]">{item.label}</span>
                </span>
                <ArrowUpRight className="h-5 w-5 text-[#9ca3af]" />
              </button>
            );
          }

          const content = (
            <>
              <span className="flex items-center gap-3">
                <Icon className="h-5 w-5 text-[#6C63FF]" />
                <span className="text-[15px] text-[#1a1a2e]">{item.label}</span>
              </span>
              <ArrowUpRight className="h-5 w-5 text-[#9ca3af]" />
            </>
          );

          if (item.href && item.external) {
            return (
              <a
                key={item.label}
                href={item.href}
                target="_blank"
                rel="noreferrer"
                className="flex items-center justify-between border-b border-[#f3f4f6] px-4 py-[14px] transition hover:bg-[#f9f8ff]"
              >
                {content}
              </a>
            );
          }

          return (
            <Link
              key={item.label}
              href={item.href ?? "/help"}
              className="flex items-center justify-between border-b border-[#f3f4f6] px-4 py-[14px] transition hover:bg-[#f9f8ff]"
            >
              {content}
            </Link>
          );
        })}
      </section>

      <section className="space-y-4">
        <h2 className="text-lg font-semibold text-[var(--text-primary)]">
          Report a bug or send feedback
        </h2>

        {done ? (
          <div className="mx-auto max-w-[480px] rounded-2xl border border-[#6C63FF] bg-[#f3f0ff] p-8 text-center text-[16px] leading-[1.8] text-[#1a1a2e]">
            <p>
              Thank you, <span className="font-bold text-[#6C63FF]">{firstName}</span>.
            </p>
            <p className="mt-4">
              We have received your message and we truly appreciate you taking the time to reach out.
            </p>
            <p className="mt-4">
              Your feedback means everything to us — it is how LessonForge gets better for every teacher across Africa.
            </p>
            <p className="mt-4">
              We will review your message personally and get back to you at{" "}
              <span className="font-bold">{email || "your email"}</span> within 24 hours.
            </p>
            <p className="mt-4">Keep teaching, keep inspiring. ✨</p>
            <p className="mt-4">— The LessonForge Team</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4 rounded-2xl border border-[var(--border)] bg-[var(--card)] p-5 shadow-sm">
            <div className="grid gap-4 md:grid-cols-2">
              <label className="space-y-2 text-sm font-medium text-[var(--text-primary)]">
                <span>Name</span>
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full rounded-xl border border-[var(--border)] bg-[var(--card-alt)] px-4 py-3 text-sm outline-none transition focus:border-violet-400"
                  placeholder="Your name"
                />
              </label>

              <label className="space-y-2 text-sm font-medium text-[var(--text-primary)]">
                <span>Email</span>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full rounded-xl border border-[var(--border)] bg-[var(--card-alt)] px-4 py-3 text-sm outline-none transition focus:border-violet-400"
                  placeholder="you@school.com"
                />
              </label>
            </div>

            <label className="block space-y-2 text-sm font-medium text-[var(--text-primary)]">
              <span>Message</span>
              <textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                rows={7}
                className="w-full resize-none rounded-xl border border-[var(--border)] bg-[var(--card-alt)] px-4 py-3 text-sm outline-none transition placeholder:text-[var(--text-tertiary)] focus:border-violet-400"
                placeholder="Describe the issue or share your feedback..."
              />
            </label>

            {error ? <p className="text-sm text-rose-600">{error}</p> : null}

            <button
              type="submit"
              disabled={submitting}
              className="inline-flex items-center justify-center rounded-xl bg-[#6C63FF] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[#5b54e6] disabled:opacity-60"
            >
              {submitting ? "Sending..." : "Send Message"}
            </button>
          </form>
        )}
      </section>

      {releaseNotesOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-lg rounded-2xl border border-[var(--border)] bg-[var(--card)] p-5 shadow-2xl">
            <div className="mb-4 flex items-center justify-between gap-3">
              <h3 className="text-lg font-semibold text-[var(--text-primary)]">Release Notes</h3>
              <button
                type="button"
                onClick={() => setReleaseNotesOpen(false)}
                className="rounded-lg px-3 py-2 text-sm font-medium text-[var(--text-secondary)] hover:bg-[var(--card-alt)]"
              >
                Close
              </button>
            </div>
            <div className="max-h-[70vh] space-y-4 overflow-y-auto text-sm text-[var(--text-secondary)]">
              {updates.map((release) => (
                <section key={release.version} className="rounded-xl border border-[var(--border)] bg-[var(--card-alt)] px-4 py-3">
                  <h4 className="font-bold text-[var(--text-primary)]">{release.version}</h4>
                  <ul className="mt-2 list-disc space-y-1 pl-5">
                    {release.items.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                </section>
              ))}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
