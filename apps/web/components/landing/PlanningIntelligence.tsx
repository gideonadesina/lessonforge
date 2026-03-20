import { motion } from "framer-motion";
import { BellRing } from "lucide-react";
import {
  planningReminders,
  planningTimeline,
} from "@/components/landing/content";
import { fadeUp, staggerParent, viewportOnce } from "@/components/landing/motion";

export function PlanningIntelligence() {
  return (
    <section id="planning" className="px-6 py-16 md:py-20">
      <div className="mx-auto grid max-w-7xl gap-8 lg:grid-cols-2">
        <motion.div
          variants={fadeUp}
          initial="hidden"
          whileInView="visible"
          viewport={viewportOnce}
          className="rounded-3xl border border-purple-100 bg-white p-7 shadow-sm"
        >
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-purple-700">
            Planning Intelligence
          </p>
          <h2 className="mt-3 text-3xl font-semibold tracking-tight text-slate-900 md:text-4xl">
            From scheme upload to weekly reminders, always one step ahead
          </h2>
          <p className="mt-4 text-sm leading-relaxed text-slate-600">
            Teachers can add their scheme of work and academic calendar, and
            LessonForge keeps everyone aligned to topics, key dates, and events.
          </p>

          <motion.ol
            variants={staggerParent}
            initial="hidden"
            whileInView="visible"
            viewport={viewportOnce}
            className="mt-7 space-y-3"
          >
            {planningTimeline.map((item, index) => (
              <motion.li
                key={item.label}
                variants={fadeUp}
                className="rounded-2xl border border-purple-100 bg-purple-50/70 p-4"
              >
                <p className="text-sm font-semibold text-slate-900">
                  {index + 1}. {item.label}
                </p>
                <p className="mt-1 text-sm text-slate-600">{item.detail}</p>
              </motion.li>
            ))}
          </motion.ol>
        </motion.div>

        <motion.div
          variants={fadeUp}
          initial="hidden"
          whileInView="visible"
          viewport={viewportOnce}
          className="rounded-3xl border border-purple-100 bg-gradient-to-b from-white to-purple-50 p-7 shadow-sm"
        >
          <div className="mb-5 flex items-center justify-between">
            <h3 className="text-base font-semibold text-slate-900">
              Smart Reminder Feed
            </h3>
            <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-purple-700 shadow-sm">
              Dashboard Preview
            </span>
          </div>

          <div className="space-y-3">
            {planningReminders.map((reminder, index) => (
              <motion.article
                key={reminder.message}
                animate={{
                  borderColor: ["#e9d5ff", "#c4b5fd", "#e9d5ff"],
                }}
                transition={{
                  duration: 2.8,
                  delay: index * 0.22,
                  repeat: Infinity,
                  ease: "easeInOut",
                }}
                className="rounded-2xl border bg-white p-4 shadow-sm"
              >
                <p className="text-xs font-semibold text-purple-700">
                  {reminder.week}
                </p>
                <p className="mt-1 flex items-start gap-2 text-sm text-slate-700">
                  <BellRing className="mt-0.5 h-4 w-4 shrink-0 text-purple-600" />
                  {reminder.message}
                </p>
              </motion.article>
            ))}
          </div>
        </motion.div>
      </div>
    </section>
  );
}