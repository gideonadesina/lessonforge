import { motion } from "framer-motion";
import { Building2, UserRound } from "lucide-react";
import {
  schoolBenefits,
  teacherBenefits,
} from "@/components/landing/content";
import { fadeUp, viewportOnce } from "@/components/landing/motion";

function BenefitList({ items }: { items: string[] }) {
  return (
    <ul className="mt-5 space-y-2">
      {items.map((item) => (
        <li
          key={item}
          className="rounded-xl border border-purple-100 bg-white/80 px-3 py-2 text-sm text-slate-700"
        >
          {item}
        </li>
      ))}
    </ul>
  );
}

export function SolutionsSplit() {
  return (
    <section id="solutions" className="px-6 py-16 md:py-20">
      <div className="mx-auto max-w-7xl">
        <motion.div
          variants={fadeUp}
          initial="hidden"
          whileInView="visible"
          viewport={viewportOnce}
          className="max-w-2xl"
        >
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-purple-700">
            Solutions
          </p>
          <h2 className="mt-3 text-3xl font-semibold tracking-tight text-slate-900 md:text-5xl">
            Built for individual teachers and school-wide teams
          </h2>
        </motion.div>

        <div className="mt-10 grid gap-5 lg:grid-cols-2">
          <motion.article
            variants={fadeUp}
            initial="hidden"
            whileInView="visible"
            viewport={viewportOnce}
            whileHover={{ y: -5 }}
            className="rounded-3xl border border-purple-100 bg-gradient-to-b from-white to-purple-50/80 p-7 shadow-sm"
          >
            <div className="inline-flex rounded-2xl bg-purple-100 p-3 text-purple-700">
              <UserRound className="h-5 w-5" />
            </div>
            <h3 className="mt-4 text-2xl font-semibold text-slate-900">
              For Teachers
            </h3>
            <p className="mt-2 text-sm leading-relaxed text-slate-600">
              Move from planning pressure to teaching confidence with fast,
              structured lesson support.
            </p>
            <BenefitList items={teacherBenefits} />
          </motion.article>

          <motion.article
            variants={fadeUp}
            initial="hidden"
            whileInView="visible"
            viewport={viewportOnce}
            whileHover={{ y: -5 }}
            className="rounded-3xl border border-purple-100 bg-gradient-to-b from-white to-purple-50/80 p-7 shadow-sm"
          >
            <div className="inline-flex rounded-2xl bg-purple-100 p-3 text-purple-700">
              <Building2 className="h-5 w-5" />
            </div>
            <h3 className="mt-4 text-2xl font-semibold text-slate-900">
              For Schools
            </h3>
            <p className="mt-2 text-sm leading-relaxed text-slate-600">
              Improve consistency, visibility, and curriculum execution across
              departments and campuses.
            </p>
            <BenefitList items={schoolBenefits} />
          </motion.article>
        </div>
      </div>
    </section>
  );
}
