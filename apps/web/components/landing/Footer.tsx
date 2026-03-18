import Link from "next/link";
import { Facebook, Instagram, Linkedin, Twitter } from "lucide-react";
import { footerColumns } from "@/components/landing/content";

const socials = [
  { label: "Twitter", href: "#", icon: Twitter },
  { label: "LinkedIn", href: "#", icon: Linkedin },
  { label: "Instagram", href: "#", icon: Instagram },
  { label: "Facebook", href: "#", icon: Facebook },
];

export function Footer() {
  return (
    <footer className="border-t border-purple-200/70 bg-white/70 px-6 pb-8 pt-14">
      <div className="mx-auto max-w-7xl">
        <div className="grid gap-10 border-b border-purple-100 pb-10 lg:grid-cols-[1.4fr_3fr]">
          <div>
            <div className="flex items-center gap-3">
              <span className="grid h-10 w-10 place-items-center rounded-xl bg-gradient-to-br from-purple-600 to-violet-500 text-sm font-semibold text-white shadow-lg shadow-purple-700/20">
                LF
              </span>
              <span className="text-lg font-semibold tracking-tight text-slate-900">
                LessonForge
              </span>
            </div>
            <p className="mt-4 max-w-sm text-sm leading-relaxed text-slate-600">
              LessonForge is an AI planning platform helping teachers and schools
              create curriculum-aligned lessons with speed, consistency, and
              confidence.
            </p>
            <div className="mt-6 flex items-center gap-2">
              {socials.map((social) => {
                const Icon = social.icon;
                return (
                  <a
                    key={social.label}
                    href={social.href}
                    aria-label={social.label}
                    className="rounded-xl border border-purple-200 bg-white p-2.5 text-slate-500 transition-colors hover:text-purple-700"
                  >
                    <Icon className="h-4 w-4" />
                  </a>
                );
              })}
            </div>
          </div>

          <div className="grid gap-8 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5">
            {footerColumns.map((column) => (
              <div key={column.title}>
                <h3 className="text-sm font-semibold text-slate-900">
                  {column.title}
                </h3>
                <ul className="mt-4 space-y-2.5">
                  {column.links.map((link) => (
                    <li key={link.label}>
                      <Link
                        href={link.href}
                        className="text-sm text-slate-600 transition-colors hover:text-purple-700"
                      >
                        {link.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>

        <div className="flex flex-col gap-2 pt-6 text-xs text-slate-500 md:flex-row md:items-center md:justify-between">
          <p>© {new Date().getFullYear()} LessonForge. All rights reserved.</p>
          <p>Calm technology for better teaching outcomes.</p>
        </div>
      </div>
    </footer>
  );
}
