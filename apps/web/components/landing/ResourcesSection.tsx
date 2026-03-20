import { motion } from "framer-motion";
import { resourceCards } from "@/components/landing/content";
import { fadeUp, staggerParent, viewportOnce } from "@/components/landing/motion";

export function ResourcesSection() {
  return (
    <section id="resources" className="px-6 py-16 md:py-20">
      <div className="mx-auto max-w-7xl">
        <motion.div
          variants={fadeUp}
          initial="hidden"
          whileInView="visible"
          viewport={viewportOnce}
          className="max-w-2xl"
        >
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-purple-700">
            Resources
          </p>
          <h2 className="mt-3 text-3xl font-semibold tracking-tight text-slate-900 md:text-5xl">
            Practical resources for teacher growth and school rollout
          </h2>
        </motion.div>

        <motion.div
          variants={staggerParent}
          initial="hidden"
          whileInView="visible"
          viewport={viewportOnce}
          className="mt-10 grid gap-5 md:grid-cols-3"
        >
          {resourceCards.map((card) => (
            <motion.article
              key={card.title}
              variants={fadeUp}
              whileHover={{ y: -5 }}
              className="rounded-3xl border border-purple-100 bg-white p-6 shadow-sm transition-shadow hover:shadow-xl hover:shadow-purple-900/10"
            >
              <h3 className="text-lg font-semibold text-slate-900">{card.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-slate-600">
                {card.description}
              </p>
            </motion.article>
          ))}
        </motion.div>
      </div>
    </section>
  );
}