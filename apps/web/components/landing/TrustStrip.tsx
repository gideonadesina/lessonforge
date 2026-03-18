import { motion } from "framer-motion";
import { trustHighlights, trustLogos } from "@/components/landing/content";
import { fadeUp, viewportOnce } from "@/components/landing/motion";

export function TrustStrip() {
  return (
    <section className="px-6 py-10">
      <motion.div
        variants={fadeUp}
        initial="hidden"
        whileInView="visible"
        viewport={viewportOnce}
        className="mx-auto flex max-w-7xl flex-col gap-5 rounded-2xl border border-purple-100 bg-white/80 p-6 shadow-sm"
      >
        <div className="flex flex-wrap gap-2">
          {trustHighlights.map((text) => (
            <span
              key={text}
              className="rounded-full border border-purple-200 bg-purple-50 px-3 py-1 text-xs font-semibold text-purple-800"
            >
              {text}
            </span>
          ))}
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {trustLogos.map((logo) => (
            <div
              key={logo}
              className="rounded-xl border border-purple-100/80 bg-white px-4 py-3 text-center text-xs font-semibold text-slate-500"
            >
              {logo}
            </div>
          ))}
        </div>
      </motion.div>
    </section>
  );
}
