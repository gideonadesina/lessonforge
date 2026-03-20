import { motion } from "framer-motion";
import { ArrowRight } from "lucide-react";
import { fadeUp, viewportOnce } from "@/components/landing/motion";

export function CTA() {
  return (
    <section id="pricing" className="px-6 py-20 md:py-24">
      <motion.div
        variants={fadeUp}
        initial="hidden"
        whileInView="visible"
        viewport={viewportOnce}
        className="mx-auto max-w-5xl rounded-[2rem] border border-purple-200 bg-gradient-to-b from-purple-700 to-purple-800 px-8 py-14 text-center text-white shadow-2xl shadow-purple-900/25"
      >
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-purple-200">
          Start Free
        </p>
        <h2 className="mt-3 text-3xl font-semibold tracking-tight md:text-5xl">
          Start teaching smarter with LessonForge
        </h2>
        <p className="mx-auto mt-4 max-w-2xl text-sm leading-relaxed text-purple-100 md:text-base">
          Join teachers and schools building better lesson quality with a calm,
          reliable AI workflow.
        </p>

        <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <a
            href="/login"
            className="inline-flex items-center gap-2 rounded-xl bg-white px-6 py-3 text-sm font-semibold text-purple-800 transition-transform duration-300 hover:-translate-y-0.5"
          >
            Start Free
            <ArrowRight className="h-4 w-4" />
          </a>
          <a
            href="#features"
            className="rounded-xl border border-purple-300/70 px-6 py-3 text-sm font-semibold text-purple-100 transition-colors hover:bg-purple-600"
          >
            View Features
          </a>
        </div>
      </motion.div>
    </section>
  );
}