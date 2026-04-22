"use client";

import LessonForgeWordmark from "@/components/auth/LessonForgeWordmark";
import AuthNotificationBanner from "@/components/auth/AuthNotificationBanner";

type Props = {
  firstName: string;
  roleType: "teacher" | "principal";
  onStart: () => void;
};

const FEATURES: Array<{
  icon: string;
  title: string;
  description: string;
  credits: string;
}> = [
  {
    icon: "📋",
    title: "Lesson Pack",
    description: "Complete, curriculum-aligned lesson plans in seconds.",
    credits: "4 credits",
  },
  {
    icon: "📝",
    title: "Worksheets & Exams",
    description: "Printable worksheets and graded exam papers on demand.",
    credits: "1 credit",
  },
  {
    icon: "🖥️",
    title: "Lesson Slides",
    description: "Ready-to-present slide decks built around your topic.",
    credits: "2 credits",
  },
  {
    icon: "🗂️",
    title: "Term Planner",
    description: "Organise your full term plan with smart reusable resources.",
    credits: "1 credit",
  },
];

export default function LessonForgeWelcomeCard({ firstName, roleType, onStart }: Props) {
  const isPrincipal = roleType === "principal";

  return (
    <div className="mx-auto w-full max-w-3xl space-y-4">
      <AuthNotificationBanner
        type="celebration"
        icon="🏆"
        message={
          isPrincipal
            ? `Welcome to LessonForge, ${firstName}! Your school workspace is set up. Explore with 8 complimentary credits.`
            : `Welcome to LessonForge, ${firstName}! Your teaching workspace is ready. You've been given 8 free credits to explore.`
        }
        subtext="8 credits ≈ 2 lesson packs · 8 worksheets · or mix as you go"
      />

      <section className="rounded-[20px] border border-[#E2E8F0] bg-white p-6 shadow-[0_4px_24px_rgba(83,74,183,0.08)] sm:p-8">
        <div className="mb-6 flex justify-center">
          <LessonForgeWordmark href={null} />
        </div>

        <h1
          className="text-center text-3xl font-bold text-[#1E1B4B]"
          style={{ fontFamily: '"Playfair Display", Georgia, serif' }}
        >
          {isPrincipal
            ? "Your school's AI-powered resource engine is ready."
            : "Your AI-powered teaching assistant is ready."}
        </h1>
        <p
          className="mt-4 text-center text-[11px] uppercase text-[#534AB7]"
          style={{ fontFamily: '"Trebuchet MS", sans-serif', letterSpacing: "2.5px" }}
        >
          HERE'S WHAT YOU CAN CREATE
        </p>

        <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2">
          {FEATURES.map((feature) => (
            <article
              key={feature.title}
              className="rounded-[14px] border border-[#E2E8F0] bg-white p-4 transition-all duration-200 hover:border-[#534AB7] hover:bg-[#FAFAFE]"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="inline-flex h-9 w-9 items-center justify-center rounded-[10px] bg-[#EEEDFE] text-lg text-[#534AB7]">
                  {feature.icon}
                </div>
                <span
                  className="rounded-[100px] bg-[#EEEDFE] px-2.5 py-1 text-[11px] text-[#534AB7]"
                  style={{ fontFamily: '"Trebuchet MS", sans-serif' }}
                >
                  {feature.credits}
                </span>
              </div>
              <h3
                className="mt-3 text-sm font-bold text-[#1E1B4B]"
                style={{ fontFamily: '"Trebuchet MS", sans-serif' }}
              >
                {feature.title}
              </h3>
              <p
                className="mt-1 text-xs text-[#475569]"
                style={{ fontFamily: '"Trebuchet MS", sans-serif' }}
              >
                {feature.description}
              </p>
            </article>
          ))}
        </div>

        <div className="mt-5 rounded-[14px] border border-[#FDE68A] bg-[#FFFBEB] p-4">
          <div className="flex items-center justify-between">
            <p
              className="font-bold text-[#92400E]"
              style={{ fontFamily: '"Trebuchet MS", sans-serif' }}
            >
              ⚡ Your Free Credits
            </p>
            <p
              className="text-3xl font-bold text-[#F59E0B]"
              style={{ fontFamily: '"Playfair Display", Georgia, serif' }}
            >
              8
            </p>
          </div>
          <div className="mt-3 h-[6px] w-full overflow-hidden rounded-full bg-[#FDE68A]">
            <div className="h-full w-full rounded-full bg-[#F59E0B]" />
          </div>
          <p
            className="mt-2 text-xs text-[#92400E]"
            style={{ fontFamily: '"Trebuchet MS", sans-serif' }}
          >
            Enough for 2 lesson packs, or 8 worksheets — mix and match freely.
          </p>
        </div>

        <button
          type="button"
          onClick={onStart}
          className="mt-5 w-full rounded-[12px] bg-gradient-to-br from-[#534AB7] to-[#3D35A0] px-5 py-[13px] text-sm font-bold text-white shadow-[0_4px_16px_rgba(83,74,183,0.35)] transition-all duration-200 hover:-translate-y-[1px] hover:shadow-[0_6px_18px_rgba(83,74,183,0.4)]"
          style={{ fontFamily: '"Trebuchet MS", sans-serif' }}
        >
          Start Generating →
        </button>
      </section>
    </div>
  );
}
