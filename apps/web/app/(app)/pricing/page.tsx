"use client";

import { useState } from "react";
import {
  LESSON_PACK_CREDIT_COST,
  NEW_USER_FREE_CREDITS,
  TEACHER_PRICING_PLANS,
  estimateLessonPacks,
  getCreditUsageNote,
} from "@/lib/billing/pricing";
import { initializeTeacherCheckout } from "@/lib/billing/checkout";
import TeacherPricingPlanCard from "@/components/billing/TeacherPricingPlanCard";

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
      <section className="rounded-3xl border border-violet-100 bg-gradient-to-br from-[var(--bg)] via-violet-50 to-violet-100/40 px-6 py-8 shadow-sm dark:via-violet-900/30 dark:to-violet-900/10 sm:px-8">
        <div className="max-w-3xl space-y-3">
          <p className="inline-flex rounded-full bg-violet-100 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-violet-700">
            Teacher pricing
          </p>
          <h1 className="text-3xl font-extrabold tracking-tight text-[var(--text-primary)] sm:text-4xl">
            Spend less time planning. Create stronger lesson packs faster.
          </h1>
          <p className="text-sm leading-relaxed text-[var(--text-secondary)] sm:text-base">
            Choose a LessonForge credit plan built for teachers. Generate lesson plans, slides,
            classroom activities, and assessments with a polished, repeatable workflow.
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

      <section className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-5 text-sm text-[var(--text-secondary)] shadow-sm">
        <p className="font-semibold text-[var(--text-primary)]">{getCreditUsageNote()}</p>
        <p className="mt-2">
          <span className="font-semibold text-[var(--text-primary)]">New users get </span>
          <span className="font-bold text-violet-700">{NEW_USER_FREE_CREDITS} free credits</span>
          <span> ({freeLessonPacks} free lesson packs)</span>
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
