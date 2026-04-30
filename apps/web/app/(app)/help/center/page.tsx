"use client";

import { useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  BookOpen,
  CheckCircle2,
  ChevronDown,
  FileQuestion,
  NotebookText,
  Search,
  ScrollText,
} from "lucide-react";

const gettingStarted = [
  {
    title: "How to Generate a Lesson Plan",
    description: "Learn how to create a complete lesson plan in 30 seconds",
    href: "/lesson-plan-generator",
    icon: ScrollText,
  },
  {
    title: "How to Generate Lesson Notes",
    description: "Create detailed teaching notes aligned to your curriculum",
    href: "/lesson-note-generator",
    icon: NotebookText,
  },
  {
    title: "How to Create Worksheets",
    description: "Generate ready-to-print worksheets for your students",
    href: "/worksheet-generator",
    icon: BookOpen,
  },
  {
    title: "How to Build Exam Questions",
    description: "Create WAEC and curriculum aligned exam papers",
    href: "/exam-question-generator",
    icon: CheckCircle2,
  },
];

const articles = [
  {
    title: "How to Write a Perfect Lesson Plan for Nigerian Schools",
    href: "/blog/how-to-write-a-lesson-plan-nigeria",
    tag: "Lesson Planning",
  },
  {
    title: "7 Tips to Prepare Students for WAEC Using AI Tools",
    href: "/blog/waec-lesson-preparation-tips",
    tag: "Exam Prep",
  },
  {
    title: "The Best AI Tools for African Teachers",
    href: "/blog/ai-tools-for-teachers-africa",
    tag: "AI Tools",
  },
  {
    title: "Lesson Notes vs Lesson Plans: What's the Difference",
    href: "/blog/lesson-notes-vs-lesson-plans",
    tag: "Teaching Tips",
  },
  {
    title: "How Nigerian Teachers Can Save 10 Hours a Week With AI",
    href: "/blog/save-time-as-a-teacher-nigeria",
    tag: "Productivity",
  },
  {
    title: "Lesson Planning Guide for Ghanaian and Kenyan Teachers",
    href: "/blog/ghana-kenya-lesson-planning-guide",
    tag: "Curriculum",
  },
];

const faqs = [
  {
    question: "How do credits work?",
    answer:
      "Each credit generates one complete lesson pack - including lesson plan, lesson notes, slides, quiz and exam questions. You start with 8 free credits. You can top up anytime from the Pricing page.",
  },
  {
    question: "What curricula does LessonForge support?",
    answer:
      "LessonForge supports NERDC, WAEC, NECO, Cambridge, GES Ghana, KNEC Kenya, UNEB Uganda, and DBE South Africa. Select your curriculum when generating a lesson.",
  },
  {
    question: "Can I edit the generated content?",
    answer:
      "Yes! After generating a lesson pack, click the Edit button to modify any section - lesson plan, notes, slides, or questions. All exports use your edited version.",
  },
  {
    question: "How does the school plan work?",
    answer:
      "A principal purchases a school plan which gives a credit pool for the entire school. Teachers join using a school code and generate lessons using the school credits - no individual payment needed.",
  },
  {
    question: "Can I export to PowerPoint?",
    answer:
      "Yes. Go to Lesson Slides, generate a deck, then click Export and choose Export to PowerPoint (.pptx). You can also export as PDF.",
  },
  {
    question: "What if generation fails?",
    answer:
      "Check your internet connection and try again. If the problem persists, use the Report a Bug form in Help & Support or email support@lessonforge.app",
  },
  {
    question: "How do I join a school workspace?",
    answer:
      "During signup or from Settings, enter the school code given to you by your principal. You will be added to the school and can generate lessons using school credits.",
  },
];

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <h2 className="mb-5 text-xl font-bold text-[#0D0A1E]">{children}</h2>;
}

export default function HelpCenterPage() {
  const [openFaq, setOpenFaq] = useState<number | null>(0);

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 text-[var(--text-primary)]">
      <header className="mb-12 space-y-5">
        <div>
          <h1 className="text-3xl font-black text-[#0D0A1E]">LessonForge Help Center</h1>
          <p className="mt-2 text-sm text-[var(--text-secondary)]">
            Everything you need to get the most out of LessonForge
          </p>
        </div>
        <label className="relative block">
          <Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-[#9ca3af]" />
          <input
            placeholder="Search for help..."
            className="w-full rounded-2xl border border-[var(--border)] bg-[var(--card)] py-3 pl-12 pr-4 text-sm outline-none transition focus:border-[#6C63FF] focus:ring-4 focus:ring-[#6C63FF]/15"
          />
        </label>
      </header>

      <section className="mb-12">
        <SectionTitle>Getting Started</SectionTitle>
        <div className="grid gap-4 md:grid-cols-2">
          {gettingStarted.map((item) => {
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-5 transition hover:bg-[#f9f8ff]"
              >
                <div className="flex items-start gap-4">
                  <span className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#f3f0ff] text-[#6C63FF]">
                    <Icon className="h-5 w-5" />
                  </span>
                  <span>
                    <span className="block text-base font-bold text-[#0D0A1E]">{item.title}</span>
                    <span className="mt-1 block text-sm leading-6 text-[var(--text-secondary)]">
                      {item.description}
                    </span>
                  </span>
                </div>
              </Link>
            );
          })}
        </div>
      </section>

      <section className="mb-12">
        <SectionTitle>Teaching Resources & Guides</SectionTitle>
        <div className="overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--card)]">
          {articles.map((article) => (
            <Link
              key={article.href}
              href={article.href}
              className="flex items-center justify-between gap-4 border-b border-[#f3f4f6] px-4 py-4 transition last:border-b-0 hover:bg-[#f9f8ff]"
            >
              <span className="min-w-0">
                <span className="mb-2 inline-flex rounded-full bg-[#f3f0ff] px-3 py-1 text-xs font-bold text-[#6C63FF]">
                  {article.tag}
                </span>
                <span className="block text-sm font-semibold text-[#1a1a2e]">{article.title}</span>
              </span>
              <ArrowRight className="h-5 w-5 shrink-0 text-[#9ca3af]" />
            </Link>
          ))}
        </div>
      </section>

      <section className="mb-12">
        <SectionTitle>Frequently Asked Questions</SectionTitle>
        <div className="overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--card)]">
          {faqs.map((faq, index) => {
            const open = openFaq === index;
            return (
              <div key={faq.question}>
                <button
                  type="button"
                  onClick={() => setOpenFaq(open ? null : index)}
                  className="flex w-full items-center justify-between gap-4 border-b border-[#f3f4f6] p-4 text-left"
                >
                  <span className="font-semibold text-[#0D0A1E]">{faq.question}</span>
                  <ChevronDown
                    className={`h-5 w-5 shrink-0 text-[#6C63FF] transition ${open ? "rotate-180" : ""}`}
                  />
                </button>
                {open ? (
                  <div className="border-b border-[#f3f4f6] bg-[#f9f8ff] p-4 text-sm leading-[1.7] text-[#374151]">
                    {faq.answer}
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      </section>

      <section className="mb-12 text-center">
        <FileQuestion className="mx-auto h-8 w-8 text-[#6C63FF]" />
        <h2 className="mt-3 text-xl font-bold text-[#0D0A1E]">Still need help?</h2>
        <div className="mt-5 flex flex-col justify-center gap-3 sm:flex-row">
          <Link
            href="/help"
            className="inline-flex items-center justify-center rounded-xl border border-[#6C63FF] px-5 py-3 text-sm font-bold text-[#6C63FF] transition hover:bg-[#f9f8ff]"
          >
            Report a Bug
          </Link>
          <a
            href="mailto:support@lessonforge.app"
            className="inline-flex items-center justify-center rounded-xl bg-[#6C63FF] px-5 py-3 text-sm font-bold text-white transition hover:bg-[#5b54e6]"
          >
            Email Support
          </a>
        </div>
        <p className="mt-4 text-sm text-[var(--text-secondary)]">
          We respond to all messages within 24 hours.
        </p>
      </section>
    </div>
  );
}
