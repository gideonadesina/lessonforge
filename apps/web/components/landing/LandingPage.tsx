"use client";

import Link from "next/link";
import { AnnouncementBar } from "@/components/landing/AnnouncementBar";
import { BenefitsSection } from "@/components/landing/BenefitsSection";
import { CTA } from "@/components/landing/CTA";
import { FeaturesGrid } from "@/components/landing/FeaturesGrid";
import { Footer } from "@/components/landing/Footer";
import { Hero } from "@/components/landing/Hero";
import { Navbar } from "@/components/landing/Navbar";
import { PlanningIntelligence } from "@/components/landing/PlanningIntelligence";
import { ResourcesSection } from "@/components/landing/ResourcesSection";
import { SolutionsSplit } from "@/components/landing/SolutionsSplit";
import { Testimonials } from "@/components/landing/Testimonials";
import { TrustStrip } from "@/components/landing/TrustStrip";

export default function LandingPage() {
  return (
    <div className="relative min-h-screen bg-[#FAF9F6] text-slate-900">
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute left-0 top-20 h-[300px] w-[320px] rounded-full bg-purple-300/20 blur-3xl" />
        <div className="absolute right-0 top-[340px] h-[340px] w-[340px] rounded-full bg-violet-300/20 blur-3xl" />
      </div>

      <AnnouncementBar />
      <Navbar />
      <main>
        <Hero />
        <TrustStrip />
        <BenefitsSection />
        <FeaturesGrid />
        <PlanningIntelligence />
        <SolutionsSplit />
        <Testimonials />
        <ExploreToolsSection />
        <ResourcesSection />
        <CTA />
      </main>
      <Footer />
    </div>
  );
}

function ExploreToolsSection() {
  const tools = [
    {
      title: "AI Lesson Plan Generator",
      href: "/lesson-plan-generator",
      description: "Generate curriculum-aligned lesson plans in seconds.",
    },
    {
      title: "Lesson Note Generator",
      href: "/lesson-note-generator",
      description: "Write detailed notes for African classrooms.",
    },
    {
      title: "Worksheet Generator",
      href: "/worksheet-generator",
      description: "Create print-ready worksheets with answers.",
    },
    {
      title: "Exam Question Generator",
      href: "/exam-question-generator",
      description: "Build exams and marking schemes quickly.",
    },
    {
      title: "AI Tools for African Teachers",
      href: "/ai-tools-for-african-teachers",
      description: "Explore the full LessonForge teaching platform.",
    },
    {
      title: "Teaching Blog",
      href: "/blog",
      description: "Read practical guides for African teachers.",
    },
  ];

  return (
    <section className="px-4 py-20 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <div className="mx-auto max-w-3xl text-center">
          <div className="text-sm font-black uppercase tracking-[0.22em] text-[#6C63FF]">
            Explore tools
          </div>
          <h2 className="mt-4 text-4xl font-black tracking-tight text-slate-950 sm:text-5xl">
            Explore LessonForge Tools
          </h2>
          <p className="mt-5 text-lg leading-8 text-slate-600">
            Start with the resource you need today, then turn it into a full lesson pack.
          </p>
        </div>
        <div className="mt-12 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
          {tools.map((tool) => (
            <Link
              key={tool.href}
              href={tool.href}
              className="group rounded-[24px] border border-slate-200 bg-white p-6 shadow-[0_22px_70px_-54px_rgba(15,23,42,0.65)] transition hover:-translate-y-1 hover:shadow-[0_30px_90px_-52px_rgba(108,99,255,0.85)]"
            >
              <h3 className="text-lg font-black text-slate-950">{tool.title}</h3>
              <p className="mt-3 text-sm leading-6 text-slate-600">{tool.description}</p>
              <span className="mt-5 inline-flex text-sm font-black text-[#6C63FF] transition group-hover:translate-x-1">
                Open tool →
              </span>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
