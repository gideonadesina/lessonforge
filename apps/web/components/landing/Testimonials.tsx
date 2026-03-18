import { motion } from "framer-motion";
import { Quote } from "lucide-react";
import { testimonials } from "@/components/landing/content";
import { fadeUp, staggerParent, viewportOnce } from "@/components/landing/motion";

export function Testimonials() {
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
            Social Proof
          </p>
          <h2 className="mt-3 text-3xl font-semibold tracking-tight text-slate-900 md:text-5xl">
            Trusted by educators building high-performing classrooms
          </h2>
        </motion.div>

        <motion.div
          variants={staggerParent}
          initial="hidden"
          whileInView="visible"
          viewport={viewportOnce}
          className="mt-10 grid gap-5 md:grid-cols-3"
        >
          {testimonials.map((item) => (
            <motion.article
              key={item.quote}
              variants={fadeUp}
              whileHover={{ y: -5 }}
              className="rounded-3xl border border-purple-100 bg-white p-6 shadow-sm transition-shadow hover:shadow-xl hover:shadow-purple-900/10"
            >
              <div className="mb-4 inline-flex rounded-xl bg-purple-100 p-2 text-purple-700">
                <Quote className="h-4 w-4" />
              </div>
              <p className="text-sm leading-relaxed text-slate-700">“{item.quote}”</p>
              <div className="mt-5 border-t border-purple-100 pt-4">
                <p className="text-sm font-semibold text-slate-900">{item.role}</p>
                <p className="text-xs text-slate-500">{item.school}</p>
              </div>
            </motion.article>
          ))}
        </motion.div>
      </div>
    </section>
  );
}
