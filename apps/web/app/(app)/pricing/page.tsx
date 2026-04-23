"use client";

import { useState } from "react";
import {
  NEW_USER_FREE_CREDITS,
  TEACHER_PRICING_PLANS,
  estimateLessonPacks,
  getCreditUsageNote,
} from "@/lib/billing/pricing";
import { initializeTeacherCheckout } from "@/lib/billing/checkout";
import TeacherPricingPlanCard from "@/components/billing/TeacherPricingPlanCard";
import LessonForgeWordmark from "@/components/auth/LessonForgeWordmark";
import AuthNotificationBanner from "@/components/auth/AuthNotificationBanner";

const FAQ_ITEMS = [
  {
    question: "What is a credit?",
    answer:
      "A credit is the unit LessonForge uses for content generation. Lesson Pack = 4 credits • Worksheet = 1 credit • Exam Builder = 1 credit",
  },
  {
    question: "How many free credits do I get?",
    answer: "New users receive 8 free credits, which equals 2 free lesson packs.",
  },
  {
    question: "What happens when my credits finish?",
    answer:
      "Generation is paused until you top up. Your existing lessons, library content, and dashboard data stay available.",
  },
  {
    question: "Does my school need separate pricing?",
    answer:
      "Yes. Schools can activate principal/school billing. View school plans at the Principal Pricing page.",
  },
] as const;

export default function PricingPage() {
  const [busyPlanId, setBusyPlanId] = useState<string | null>(null);
  const freeLessonPacks = estimateLessonPacks(NEW_USER_FREE_CREDITS);

  async function handleTeacherPlanSelect(planId: (typeof TEACHER_PRICING_PLANS)[number]["id"]) {
    setBusyPlanId(planId);
    try {
      await initializeTeacherCheckout(planId);
    } catch (error) {
      console.error("Failed to start checkout:", error);
      alert("We could not start checkout right now. Please try again.");
    } finally {
      setBusyPlanId(null);
    }
  }

  return (
    <div className="space-y-8 pb-8">
      <AuthNotificationBanner
        type="celebration"
        icon="🎊"
        message="You've fully explored LessonForge with your free credits — now let's unlock the full experience."
        subtext="Join thousands of teachers who plan faster, teach better, and save hours every week."
      />

      <section className="rounded-[20px] border border-[#E2E8F0] bg-white px-6 py-8 shadow-[0_4px_24px_rgba(83,74,183,0.08)] sm:px-8">
        <div className="mb-6 flex justify-center">
          <LessonForgeWordmark href={null} />
        </div>
        <div className="max-w-3xl space-y-3">
          <h1
            className="text-3xl font-bold tracking-tight text-[#1E1B4B] sm:text-4xl"
            style={{ fontFamily: '"Playfair Display", Georgia, serif' }}
          >
            Keep creating without limits.
          </h1>
          <p
            className="text-sm leading-relaxed text-[#475569] sm:text-base"
            style={{ fontFamily: '"Trebuchet MS", sans-serif' }}
          >
            Generate as you go — plans, worksheets, slides, and more. Pick what fits your classroom.
          </p>
        </div>
      </section>

      <section className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        {TEACHER_PRICING_PLANS.map((plan) => (
          <TeacherPricingPlanCard
            key={plan.id}
            plan={plan}
            loading={busyPlanId === plan.id}
            onSelect={handleTeacherPlanSelect}
          />
        ))}
      </section>

      <section className="rounded-[20px] border border-[#E2E8F0] bg-white p-5 text-sm text-[#475569] shadow-[0_4px_24px_rgba(83,74,183,0.08)]">
        <p className="font-semibold text-[#1E1B4B]" style={{ fontFamily: '"Trebuchet MS", sans-serif' }}>
          {getCreditUsageNote()}
        </p>
        <p className="mt-2" style={{ fontFamily: '"Trebuchet MS", sans-serif' }}>
          <span className="font-semibold text-[#1E1B4B]">New users get </span>
          <span className="font-bold text-[#534AB7]">{NEW_USER_FREE_CREDITS} free credits</span>
          <span> ({freeLessonPacks} free lesson packs)</span>
        </p>
        <button
          type="button"
          className="mt-5 w-full rounded-[12px] bg-gradient-to-br from-[#534AB7] to-[#3D35A0] px-5 py-[13px] text-sm font-bold text-white shadow-[0_4px_16px_rgba(83,74,183,0.35)] transition-all duration-200 hover:-translate-y-[1px] hover:shadow-[0_6px_18px_rgba(83,74,183,0.4)]"
          style={{ fontFamily: '"Trebuchet MS", sans-serif' }}
        >
          Choose My Plan →
        </button>
        <p
          className="mt-2 text-center text-xs text-[#94A3B8]"
          style={{ fontFamily: '"Trebuchet MS", sans-serif' }}
        >
          Cancel anytime · Instant access · No hidden fees
        </p>
      </section>

      <section className="rounded-3xl border border-[var(--border)] bg-[var(--card)] p-6 shadow-sm">
        <h2 className="text-xl font-bold text-[var(--text-primary)]">Frequently asked questions</h2>
        <div className="mt-4 space-y-4">
          {FAQ_ITEMS.map((item) => (
            <article key={item.question} className="rounded-2xl border border-[var(--border)] bg-[var(--card-alt)] p-4">
              <h3 className="text-sm font-semibold text-[var(--text-primary)]">{item.question}</h3>
              <p className="mt-2 text-sm leading-relaxed text-[var(--text-secondary)]">{item.answer}</p>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}
