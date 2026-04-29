"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { useState } from "react";

const navLinks = [
  { label: "Features", href: "/#features" },
  { label: "Blog", href: "/blog" },
  { label: "Pricing", href: "/pricing" },
];

export function MarketingShell({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="min-h-screen bg-[#FBFAFF] text-slate-950">
      <header className="sticky top-0 z-50 border-b border-slate-200/70 bg-white/90 backdrop-blur-xl">
        <nav className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <Link href="/" className="inline-flex items-center">
            <img src="/lessonforge_logo_horizontal.svg" alt="LessonForge" height="36" />
          </Link>

          <div className="hidden items-center gap-8 md:flex">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="text-sm font-semibold text-slate-600 transition hover:text-[#6C63FF]"
              >
                {link.label}
              </Link>
            ))}
          </div>

          <div className="hidden md:block">
            <Link
              href="/signup"
              className="rounded-full bg-[#6C63FF] px-5 py-2.5 text-sm font-bold text-white shadow-[0_14px_30px_-16px_rgba(108,99,255,0.9)] transition hover:bg-[#5B52E8]"
            >
              Get Started Free
            </Link>
          </div>

          <button
            type="button"
            aria-label="Toggle menu"
            onClick={() => setOpen((value) => !value)}
            className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 text-slate-700 md:hidden"
          >
            <span className="text-xl leading-none">{open ? "x" : "☰"}</span>
          </button>
        </nav>

        {open && (
          <div className="border-t border-slate-200 bg-white px-4 py-4 shadow-lg md:hidden">
            <div className="mx-auto flex max-w-7xl flex-col gap-2">
              {navLinks.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  onClick={() => setOpen(false)}
                  className="rounded-xl px-3 py-3 text-sm font-semibold text-slate-700 hover:bg-violet-50"
                >
                  {link.label}
                </Link>
              ))}
              <Link
                href="/signup"
                onClick={() => setOpen(false)}
                className="mt-2 rounded-xl bg-[#6C63FF] px-4 py-3 text-center text-sm font-bold text-white"
              >
                Get Started Free
              </Link>
            </div>
          </div>
        )}
      </header>

      {children}

      <footer className="border-t border-slate-200 bg-white">
        <div className="mx-auto grid max-w-7xl gap-10 px-4 py-12 sm:px-6 md:grid-cols-2 lg:px-8">
          <div>
            <div className="text-2xl font-black text-[#6C63FF]">LessonForge</div>
            <p className="mt-3 max-w-md text-sm leading-6 text-slate-600">
              AI lesson planning built for African teachers, local curricula, and real classroom workflows.
            </p>
            <p className="mt-5 text-xs text-slate-400">© 2025 LessonForge</p>
          </div>
          <div className="md:justify-self-end">
            <h3 className="text-sm font-bold uppercase tracking-[0.2em] text-slate-400">
              Quick Links
            </h3>
            <div className="mt-4 grid grid-cols-2 gap-x-8 gap-y-3 text-sm font-semibold text-slate-600">
              {[
                ["Generate", "/generate"],
                ["Library", "/library"],
                ["Blog", "/blog"],
                ["Pricing", "/pricing"],
                ["Contact", "mailto:hello@lessonforge.app"],
              ].map(([label, href]) => (
                <Link key={href} href={href} className="hover:text-[#6C63FF]">
                  {label}
                </Link>
              ))}
            </div>
          </div>
        </div>
        <div className="border-t border-slate-100 px-4 py-5 text-center text-sm font-medium text-slate-500">
          Built with ❤️ for African teachers · lessonforge.app
        </div>
      </footer>
    </div>
  );
}
