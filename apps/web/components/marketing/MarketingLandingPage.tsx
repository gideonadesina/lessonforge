import Link from "next/link";
import { PexelsImage } from "./PexelsImage";

export type FeatureItem = {
  icon: string;
  title: string;
  description: string;
};

type LandingPageProps = {
  hero: {
    headline: string;
    subheadline: string;
    query: string;
  };
  features: FeatureItem[];
  example?: boolean;
  countries?: string[];
  curricula?: string[];
};

const stats = ["10,000+ Lessons Generated", "5,000+ African Teachers", "15+ Curricula Supported"];

const steps = [
  {
    title: "Choose Your Subject & Topic",
    icon: "📚",
    description: "Enter the class, topic, duration, and learning level you want to teach.",
  },
  {
    title: "Select Your Curriculum & Class",
    icon: "🎯",
    description: "Match your lesson to NERDC, WAEC, NECO, Cambridge, GES, KNEC, or local standards.",
  },
  {
    title: "Download Your Complete Lesson Pack",
    icon: "⬇️",
    description: "Export lesson plans, notes, slides, questions, and activities in minutes.",
  },
];

const testimonials = [
  {
    quote: "LessonForge saved me 2 hours every day. I can now focus on actually teaching.",
    author: "Mrs. Adaeze O.",
    role: "Biology Teacher, Lagos",
  },
  {
    quote: "The slides it generates are better than what I used to make in PowerPoint for 30 minutes.",
    author: "Mr. Kwame A.",
    role: "Science Teacher, Accra",
  },
  {
    quote: "Finally an AI tool that understands Nigerian curriculum. It even cites our textbooks!",
    author: "Miss Fatima M.",
    role: "JSS Teacher, Kano",
  },
];

export function MarketingLandingPage({
  hero,
  features,
  example = false,
  countries,
  curricula,
}: LandingPageProps) {
  return (
    <main className="bg-[#FBFAFF]">
      <section className="relative isolate overflow-hidden">
        <PexelsImage query={hero.query} className="min-h-[720px]">
          <div className="absolute inset-0 bg-slate-950/55" />
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_25%_20%,rgba(108,99,255,0.55),transparent_36%),linear-gradient(90deg,rgba(15,23,42,0.92),rgba(15,23,42,0.42),rgba(15,23,42,0.72))]" />
          <div className="relative mx-auto flex min-h-[720px] max-w-7xl items-center px-4 py-24 sm:px-6 lg:px-8">
            <div className="max-w-4xl">
              <div className="mb-6 inline-flex rounded-full border border-white/20 bg-white/10 px-4 py-2 text-sm font-bold text-white shadow-2xl backdrop-blur">
                Built for African classrooms
              </div>
              <h1 className="max-w-5xl text-5xl font-black leading-[0.96] tracking-tight text-white sm:text-6xl lg:text-7xl">
                {hero.headline}
              </h1>
              <p className="mt-7 max-w-3xl text-lg leading-8 text-white/88 sm:text-xl">
                {hero.subheadline}
              </p>
              <div className="mt-10 flex flex-col gap-3 sm:flex-row">
                <Link
                  href="/generate"
                  className="rounded-full bg-[#6C63FF] px-7 py-4 text-center text-base font-black text-white shadow-[0_24px_60px_-24px_rgba(108,99,255,0.95)] transition hover:bg-[#5B52E8]"
                >
                  Generate Free Lesson Plan →
                </Link>
                <a
                  href="#example"
                  className="rounded-full border border-white/35 bg-white/10 px-7 py-4 text-center text-base font-black text-white backdrop-blur transition hover:bg-white/20"
                >
                  See Example Output
                </a>
              </div>
            </div>
          </div>
        </PexelsImage>
      </section>

      <section className="bg-[#1a1a2e]">
        <div className="mx-auto grid max-w-7xl gap-6 px-4 py-9 text-white sm:px-6 md:grid-cols-3 lg:px-8">
          {stats.map((stat) => {
            const [number, ...rest] = stat.split(" ");
            return (
              <div key={stat} className="text-center md:text-left">
                <div className="text-4xl font-black tracking-tight">{number}</div>
                <div className="mt-1 text-sm font-semibold text-white/70">{rest.join(" ")}</div>
              </div>
            );
          })}
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-24 sm:px-6 lg:px-8">
        <SectionHeader
          eyebrow="How it works"
          title="From blank page to complete lesson pack"
          subtitle="A focused workflow built around the way African teachers actually prepare."
        />
        <div className="mt-12 grid gap-6 md:grid-cols-3">
          {steps.map((step, index) => (
            <article
              key={step.title}
              className="rounded-[28px] border border-slate-200 bg-white p-7 shadow-[0_24px_70px_-48px_rgba(15,23,42,0.45)]"
            >
              <div className="flex items-center justify-between">
                <span className="text-3xl">{step.icon}</span>
                <span className="flex h-10 w-10 items-center justify-center rounded-full bg-[#6C63FF] text-sm font-black text-white">
                  {index + 1}
                </span>
              </div>
              <h3 className="mt-7 text-xl font-black text-slate-950">{step.title}</h3>
              <p className="mt-3 text-sm leading-6 text-slate-600">{step.description}</p>
            </article>
          ))}
        </div>
      </section>

      <section id="features" className="bg-white py-24">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <SectionHeader
            eyebrow="Features"
            title="Everything teachers need in one workspace"
            subtitle="Designed for speed, editability, and curriculum accuracy from the first output."
          />
          <div className="mt-12 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
            {features.map((feature) => (
              <article
                key={feature.title}
                className="rounded-[26px] border border-slate-200 bg-[#FBFAFF] p-7 transition hover:-translate-y-1 hover:shadow-[0_26px_70px_-42px_rgba(108,99,255,0.7)]"
              >
                <div className="text-3xl">{feature.icon}</div>
                <h3 className="mt-5 text-lg font-black text-slate-950">{feature.title}</h3>
                <p className="mt-3 text-sm leading-6 text-slate-600">{feature.description}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      {(countries || curricula) && (
        <section className="mx-auto max-w-7xl px-4 py-24 sm:px-6 lg:px-8">
          {countries && <PillSection title="Countries We Support" items={countries} />}
          {curricula && <PillSection title="Curricula We Support" items={curricula} purple />}
        </section>
      )}

      {example && <ExampleSection />}

      <section className="bg-white py-24">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <SectionHeader
            eyebrow="Teacher voices"
            title="Built around real classroom pressure"
            subtitle="Teachers use LessonForge to reclaim planning time without lowering lesson quality."
          />
          <div className="mt-12 grid gap-6 md:grid-cols-3">
            {testimonials.map((item) => (
              <article
                key={item.author}
                className="rounded-[26px] border border-slate-200 border-l-[#6C63FF] border-l-4 bg-white p-7 shadow-[0_22px_60px_-48px_rgba(15,23,42,0.6)]"
              >
                <div className="text-sm font-black tracking-[0.16em] text-[#6C63FF]">★★★★★</div>
                <p className="mt-5 text-base font-semibold leading-7 text-slate-800">“{item.quote}”</p>
                <div className="mt-6 text-sm">
                  <div className="font-black text-slate-950">{item.author}</div>
                  <div className="mt-1 text-slate-500">{item.role}</div>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-[#1a1a2e] px-4 py-24 text-center text-white sm:px-6 lg:px-8">
        <h2 className="mx-auto max-w-3xl text-4xl font-black tracking-tight sm:text-5xl">
          Start Generating Lesson Plans Free Today
        </h2>
        <p className="mx-auto mt-5 max-w-2xl text-lg leading-8 text-white/70">
          Join 5,000+ African teachers saving hours every week with LessonForge.
        </p>
        <Link
          href="/signup"
          className="mt-9 inline-flex rounded-full bg-[#6C63FF] px-8 py-4 text-base font-black text-white transition hover:bg-[#5B52E8]"
        >
          Get Started Free →
        </Link>
      </section>

      <footer className="bg-white px-4 py-8 text-center text-sm text-slate-500">
        © 2025 LessonForge · lessonforge.app
        <div className="mt-3 flex flex-wrap justify-center gap-4 font-semibold">
          {[
            ["Home", "/"],
            ["Generate", "/generate"],
            ["Library", "/library"],
            ["Blog", "/blog"],
            ["Pricing", "/pricing"],
          ].map(([label, href]) => (
            <Link key={href} href={href} className="text-slate-600 hover:text-[#6C63FF]">
              {label}
            </Link>
          ))}
        </div>
      </footer>
    </main>
  );
}

function SectionHeader({
  eyebrow,
  title,
  subtitle,
}: {
  eyebrow: string;
  title: string;
  subtitle: string;
}) {
  return (
    <div className="mx-auto max-w-3xl text-center">
      <div className="text-sm font-black uppercase tracking-[0.22em] text-[#6C63FF]">{eyebrow}</div>
      <h2 className="mt-4 text-4xl font-black tracking-tight text-slate-950 sm:text-5xl">{title}</h2>
      <p className="mt-5 text-lg leading-8 text-slate-600">{subtitle}</p>
    </div>
  );
}

function PillSection({ title, items, purple = false }: { title: string; items: string[]; purple?: boolean }) {
  return (
    <div className="mb-14 rounded-[30px] border border-slate-200 bg-white p-8 shadow-[0_24px_70px_-52px_rgba(15,23,42,0.5)]">
      <h2 className="text-2xl font-black text-slate-950">{title}</h2>
      <div className="mt-6 flex flex-wrap gap-3">
        {items.map((item) => (
          <span
            key={item}
            className={[
              "rounded-full px-4 py-2 text-sm font-bold",
              purple ? "bg-[#6C63FF] text-white" : "bg-violet-50 text-[#5B52E8]",
            ].join(" ")}
          >
            {item}
          </span>
        ))}
      </div>
    </div>
  );
}

function ExampleSection() {
  return (
    <section id="example" className="bg-[#F4F2FF] py-24">
      <div className="mx-auto grid max-w-7xl items-center gap-10 px-4 sm:px-6 lg:grid-cols-[0.86fr_1.14fr] lg:px-8">
        <div>
          <div className="text-sm font-black uppercase tracking-[0.22em] text-[#6C63FF]">Example output</div>
          <h2 className="mt-4 text-4xl font-black tracking-tight text-slate-950 sm:text-5xl">
            A complete pack your school can use immediately
          </h2>
          <p className="mt-5 text-lg leading-8 text-slate-600">
            LessonForge creates structured, editable material with objectives, notes, checks for understanding, and assessment questions.
          </p>
        </div>
        <div className="rounded-[30px] border border-white bg-white p-6 shadow-[0_30px_90px_-55px_rgba(108,99,255,0.9)]">
          <div className="rounded-2xl bg-slate-950 p-5 text-white">
            <div className="text-xs font-bold uppercase tracking-[0.24em] text-violet-200">
              JSS 2 · Basic Science
            </div>
            <h3 className="mt-3 text-3xl font-black">Photosynthesis</h3>
          </div>
          <div className="grid gap-5 p-5 md:grid-cols-2">
            <div>
              <h4 className="font-black text-slate-950">Objectives</h4>
              <ul className="mt-3 space-y-2 text-sm leading-6 text-slate-600">
                <li>1. Define photosynthesis in simple terms.</li>
                <li>2. Identify sunlight, chlorophyll, water, and carbon dioxide as inputs.</li>
                <li>3. Explain why plants are called producers.</li>
              </ul>
            </div>
            <div>
              <h4 className="font-black text-slate-950">Lesson Notes</h4>
              <p className="mt-3 text-sm leading-6 text-slate-600">
                Photosynthesis is the process by which green plants make food using sunlight. The green pigment chlorophyll traps light energy and helps convert water and carbon dioxide into glucose.
              </p>
            </div>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-[#FBFAFF] p-5">
            <h4 className="font-black text-slate-950">Sample MCQs</h4>
            <div className="mt-3 grid gap-4 text-sm text-slate-700 md:grid-cols-2">
              <p>1. Which pigment traps sunlight? A. Haemoglobin B. Chlorophyll C. Iodine D. Starch</p>
              <p>2. Which gas is used in photosynthesis? A. Oxygen B. Nitrogen C. Carbon dioxide D. Hydrogen</p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
