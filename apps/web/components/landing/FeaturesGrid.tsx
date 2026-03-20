import { motion } from "framer-motion";
import { FeatureCard } from "@/components/landing/FeatureCard";
import { features } from "@/components/landing/content";
import { fadeUp, staggerParent, viewportOnce } from "@/components/landing/motion";

export function FeaturesGrid() {
  return (
    <section id="features" className="px-6 py-16 md:py-20">
      <div className="mx-auto max-w-7xl">
        <motion.div
          variants={fadeUp}
          initial="hidden"
          whileInView="visible"
          viewport={viewportOnce}
          className="max-w-2xl"
        >
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-purple-700">
            Core Product
          </p>
          <h2 className="mt-3 text-3xl font-semibold tracking-tight text-slate-900 md:text-5xl">
            Everything needed to run a high-performing teaching workflow
          </h2>
        </motion.div>

        <motion.div
          variants={staggerParent}
          initial="hidden"
          whileInView="visible"
          viewport={viewportOnce}
          className="mt-10 grid gap-5 md:grid-cols-2 xl:grid-cols-4"
        >
          {features.map((feature) => (
            <FeatureCard key={feature.title} feature={feature} />
          ))}
        </motion.div>
      </div>
    </section>
  );
}