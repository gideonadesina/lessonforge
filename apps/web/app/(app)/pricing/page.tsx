"use client";

import Link from "next/link";
import { useState } from "react";
import {
  LESSON_PACK_CREDIT_COST,
  NEW_USER_FREE_CREDITS,
  TEACHER_PRICING_PLANS,
  estimateLessonPacks,
} from "@/lib/billing/pricing";
import { initializeTeacherCheckout } from "@/lib/billing/checkout";
import TeacherPricingPlanCard from "@/components/billing/TeacherPricingPlanCard";

const FAQ_ITEMS = [
  {
    question: "What is a credit?",
    answer:
      "A credit is the unit LessonForge uses for lesson generation. One complete lesson pack consumes 4 credits.",
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
    question: "Do principals/schools have separate pricing?",
    answer:
      "Yes. Schools can activate principal billing for teacher slots and workspace-wide management.",
  },
] as const;

export default function PricingPage() {
  const [busyPlanId, setBusyPlanId] = useState<string | null>(null);
  const freeLessonPacks = estimateLessonPacks(NEW_USER_FREE_CREDITS);

  async function handlePlanSelect(planId: (typeof TEACHER_PRICING_PLANS)[number]["id"]) {
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
      <section className="rounded-3xl border border-violet-100 bg-gradient-to-br from-[#FFFEFC] via-[#F9F5FF] to-[#F3EEFF] px-6 py-8 shadow-sm sm:px-8">
        <div className="max-w-3xl space-y-3">
          <p className="inline-flex rounded-full bg-violet-100 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-violet-700">
            Teacher pricing
          </p>
          <h1 className="text-3xl font-extrabold tracking-tight text-slate-900 sm:text-4xl">
            Spend less time planning. Create stronger lesson packs faster.
          </h1>
          <p className="text-sm leading-relaxed text-slate-600 sm:text-base">
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
            onSelect={handlePlanSelect}
          />
        ))}
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 text-sm text-slate-700 shadow-sm">
        <p>
          <span className="font-semibold text-slate-900">1 Lesson Pack = </span>
          <span className="font-bold text-violet-700">{LESSON_PACK_CREDIT_COST} credits</span>
        </p>
        <p className="mt-1">
          <span className="font-semibold text-slate-900">New users get </span>
          <span className="font-bold text-violet-700">{NEW_USER_FREE_CREDITS} free credits</span>
          <span> ({freeLessonPacks} free lesson packs)</span>
        </p>
      </section>

      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-xl font-bold text-slate-900">Frequently asked questions</h2>
        <div className="mt-4 space-y-4">
          {FAQ_ITEMS.map((item) => (
            <article key={item.question} className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
              <h3 className="text-sm font-semibold text-slate-900">{item.question}</h3>
              <p className="mt-2 text-sm leading-relaxed text-slate-600">{item.answer}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="rounded-3xl border border-violet-100 bg-violet-50/60 p-6 shadow-sm">
        <div className="max-w-3xl">
          <h2 className="text-2xl font-bold tracking-tight text-slate-900">
            School-wide access for principals and administrators
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-slate-600">
            Deploy LessonForge across departments, pay for teacher slots, and coordinate a shared
            planning standard for your school team.
          </p>
          <Link
            href="/principal"
            className="mt-4 inline-flex rounded-2xl bg-violet-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-violet-700"
          >
            Get School Access
          </Link>
        </div>
      </section>
    </div>
  );
}
