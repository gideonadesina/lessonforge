import { motion } from "framer-motion";
import { ArrowRight, CalendarDays, CheckCircle2, Sparkles } from "lucide-react";
import { fadeUp, viewportOnce } from "@/components/landing/motion";
import { stats } from "@/components/landing/content";

export function Hero() {
  return (
    <section className="relative overflow-hidden px-6 pb-20 pt-16 md:pb-24 md:pt-20">
      <div className="absolute left-1/2 top-0 -z-10 h-[420px] w-[800px] -translate-x-1/2 rounded-full bg-purple-300/20 blur-3xl" />
      <div className="mx-auto grid max-w-7xl gap-12 lg:grid-cols-2 lg:gap-14">
        <motion.div
          variants={fadeUp}
          initial="hidden"
          animate="visible"
          className="flex flex-col justify-center"
        >
          <div className="mb-6 inline-flex w-fit items-center gap-2 rounded-full border border-purple-200 bg-white/80 px-4 py-2 text-xs font-semibold text-purple-700 shadow-sm">
            <Sparkles className="h-3.5 w-3.5" />
            AI planning for modern educators
          </div>

          <h1 className="max-w-2xl text-4xl font-semibold leading-tight tracking-tight text-slate-900 md:text-6xl">
            Plan smarter lessons with calm, curriculum-aligned intelligence.
          </h1>
          <p className="mt-6 max-w-xl text-base leading-relaxed text-slate-600 md:text-lg">
            LessonForge helps teachers and schools generate high-quality teaching
            materials instantly while staying aligned to weekly learning goals.
          </p>

          <div className="mt-9 flex flex-col gap-3 sm:flex-row">
            <a
              href="#pricing"
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-purple-700 px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-purple-900/20 transition-all duration-300 hover:-translate-y-0.5 hover:bg-purple-800"
            >
              Start Free
              <ArrowRight className="h-4 w-4" />
            </a>
            <a
              href="#planning"
              className="inline-flex items-center justify-center rounded-xl border border-purple-200 bg-white px-6 py-3 text-sm font-semibold text-purple-800 transition-all duration-300 hover:-translate-y-0.5 hover:border-purple-300 hover:shadow-md"
            >
              See How It Works
            </a>
          </div>

          <div className="mt-10 grid max-w-md grid-cols-3 gap-3">
            {stats.map((stat) => (
              <div
                key={stat.label}
                className="rounded-2xl border border-purple-100 bg-white/80 p-3 shadow-sm"
              >
                <p className="text-lg font-semibold tracking-tight text-slate-900">
                  {stat.value}
                </p>
                <p className="mt-1 text-xs text-slate-600">{stat.label}</p>
              </div>
            ))}
          </div>
        </motion.div>

        <motion.div
          variants={fadeUp}
          initial="hidden"
          whileInView="visible"
          viewport={viewportOnce}
          className="relative min-h-[430px] rounded-3xl border border-purple-200/70 bg-gradient-to-b from-white to-purple-50/70 p-5 shadow-2xl shadow-purple-900/10 md:p-7"
        >
          <div className="rounded-2xl border border-purple-100 bg-white p-5 shadow-sm">
            <div className="mb-5 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-slate-900">
                Weekly Teaching Dashboard
              </h3>
              <span className="rounded-full bg-purple-100 px-2 py-1 text-[11px] font-semibold text-purple-800">
                Live
              </span>
            </div>
            <div className="space-y-3">
              <div className="rounded-xl bg-purple-50 p-3">
                <p className="text-xs font-semibold text-purple-700">Monday Focus</p>
                <p className="mt-1 text-sm text-slate-700">
                  Week 3 Algebraic Expressions and classroom practice.
                </p>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-xl border border-purple-100 p-3">
                  <p className="text-xs text-slate-500">Lesson plans ready</p>
                  <p className="mt-1 text-2xl font-semibold text-slate-900">14</p>
                </div>
                <div className="rounded-xl border border-purple-100 p-3">
                  <p className="text-xs text-slate-500">Assessments scheduled</p>
                  <p className="mt-1 text-2xl font-semibold text-slate-900">6</p>
                </div>
              </div>
              <div className="rounded-xl border border-dashed border-purple-200 p-3">
                <p className="text-xs text-slate-500">Upcoming event</p>
                <p className="mt-1 flex items-center gap-1.5 text-sm font-medium text-slate-800">
                  <CalendarDays className="h-4 w-4 text-purple-600" />
                  Mid-term review in 4 days
                </p>
              </div>
            </div>
          </div>

          <motion.div
            animate={{ y: [-3, 5, -3] }}
            transition={{ duration: 6.5, repeat: Infinity, ease: "easeInOut" }}
            className="absolute -left-5 top-8 rounded-2xl border border-purple-200 bg-white px-4 py-3 shadow-lg shadow-purple-900/10"
          >
            <p className="text-xs font-semibold text-slate-900">
              Lesson Generated in 12 seconds
            </p>
          </motion.div>

          <motion.div
            animate={{ y: [4, -6, 4] }}
            transition={{ duration: 7, repeat: Infinity, ease: "easeInOut" }}
            className="absolute -right-5 top-24 rounded-2xl border border-purple-200 bg-white px-4 py-3 shadow-lg shadow-purple-900/10"
          >
            <p className="text-xs font-semibold text-slate-900">
              Aligned to WAEC curriculum
            </p>
          </motion.div>

          <motion.div
            animate={{ y: [2, -5, 2] }}
            transition={{ duration: 7.2, repeat: Infinity, ease: "easeInOut" }}
            className="absolute -bottom-4 right-10 rounded-2xl border border-purple-200 bg-white px-4 py-3 shadow-lg shadow-purple-900/10"
          >
            <p className="flex items-center gap-1.5 text-xs font-semibold text-slate-900">
              <CheckCircle2 className="h-4 w-4 text-purple-600" />
              Week 3 topic reminder
            </p>
          </motion.div>
        </motion.div>
      </div>
    </section>
  );
}