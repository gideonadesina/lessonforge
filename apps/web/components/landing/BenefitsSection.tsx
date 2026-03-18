import { motion } from "framer-motion";
import { benefits } from "@/components/landing/content";
import { fadeUp, staggerParent, viewportOnce } from "@/components/landing/motion";

export function BenefitsSection() {
  return (
    <section className="px-6 py-16 md:py-20">
      <div className="mx-auto max-w-7xl">
        <motion.div
          variants={fadeUp}
          initial="hidden"
          whileInView="visible"
          viewport={viewportOnce}
          className="max-w-2xl"
        >
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-purple-700">
            Benefits
          </p>
          <h2 className="mt-3 text-3xl font-semibold tracking-tight text-slate-900 md:text-5xl">
            Built to simplify planning and elevate classroom outcomes
          </h2>
        </motion.div>

        <motion.div
          variants={staggerParent}
          initial="hidden"
          whileInView="visible"
          viewport={viewportOnce}
          className="mt-10 grid gap-5 md:grid-cols-2 lg:grid-cols-4"
        >
          {benefits.map((benefit) => {
            const Icon = benefit.icon;
            return (
              <motion.article
                key={benefit.title}
                variants={fadeUp}
                whileHover={{ y: -5, transition: { duration: 0.2 } }}
                className="rounded-3xl border border-purple-100 bg-white p-6 shadow-sm transition-shadow hover:shadow-xl hover:shadow-purple-900/10"
              >
                <div className="mb-5 inline-flex rounded-2xl bg-purple-100 p-3 text-purple-700">
                  <Icon className="h-5 w-5" />
                </div>
                <h3 className="text-lg font-semibold text-slate-900">
                  {benefit.title}
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-slate-600">
                  {benefit.description}
                </p>
              </motion.article>
            );
          })}
        </motion.div>
      </div>
    </section>
  );
}
