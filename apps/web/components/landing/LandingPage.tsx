"use client";

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
        <ResourcesSection />
        <CTA />
      </main>
      <Footer />
    </div>
  );
}