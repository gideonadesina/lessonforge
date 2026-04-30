import Link from "next/link";
import { BookOpen, CreditCard, GraduationCap, LifeBuoy, School, Settings } from "lucide-react";

const sections = [
  {
    title: "Generate lesson packs",
    body: "Create lesson plans, notes, slides, quizzes, and classroom activities from the Generate page.",
    href: "/generate",
    icon: GraduationCap,
  },
  {
    title: "Manage your library",
    body: "Open saved lessons, export files, review slides, and reuse generated packs from your library.",
    href: "/library",
    icon: BookOpen,
  },
  {
    title: "Billing and credits",
    body: "Check credits, top up your account, and review billing options for individual teacher accounts.",
    href: "/pricing",
    icon: CreditCard,
  },
  {
    title: "School workspace",
    body: "Invite teachers, manage shared credits, and monitor school activity from the principal workspace.",
    href: "/principal",
    icon: School,
  },
  {
    title: "Account settings",
    body: "Review profile details, plan information, and account preferences.",
    href: "/settings",
    icon: Settings,
  },
  {
    title: "Contact support",
    body: "Use the Help menu support form or email support@lessonforge.app for account-specific help.",
    href: "mailto:support@lessonforge.app",
    icon: LifeBuoy,
  },
];

export default function HelpPage() {
  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm font-semibold uppercase tracking-wide text-violet-700">Help Center</p>
        <h1 className="mt-2 text-3xl font-black text-[var(--text-primary)]">How can we help?</h1>
        <p className="mt-2 max-w-2xl text-sm text-[var(--text-secondary)]">
          Find the fastest path to common LessonForge tasks and support channels.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {sections.map((section) => {
          const Icon = section.icon;
          return (
            <Link
              key={section.title}
              href={section.href}
              className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
            >
              <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-violet-100 text-violet-700">
                <Icon className="h-5 w-5" />
              </span>
              <h2 className="mt-4 text-base font-bold text-[var(--text-primary)]">{section.title}</h2>
              <p className="mt-2 text-sm leading-6 text-[var(--text-secondary)]">{section.body}</p>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
