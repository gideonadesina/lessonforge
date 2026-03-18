import Link from "next/link";

const roleCards = [
  {
    title: "Teacher",
    subtitle: "Create lessons, worksheets, and exams faster.",
    href: "/auth/teacher",
    cta: "Continue as Teacher",
  },
  {
    title: "Principal / School Admin",
    subtitle: "Manage teachers, activity, and school planning.",
    href: "/auth/principal",
    cta: "Continue as Principal",
  },
];

export default function SelectRolePage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-[#FAF9F6] p-4 sm:p-6">
      <section className="w-full max-w-3xl rounded-3xl border border-slate-200/80 bg-white p-6 shadow-[0_20px_50px_-28px_rgba(15,23,42,0.4)] sm:p-8">
        <div className="mb-7 text-center">
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-indigo-700/90">
            SCHOOL WORKSPACE
          </p>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight text-slate-900">
            Choose your role
          </h1>
          <p className="mt-2 text-sm text-slate-600">
            Select the experience that matches your school workspace access.
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          {roleCards.map((role) => (
            <Link
              key={role.title}
              href={role.href}
              className="rounded-2xl border border-slate-200 bg-slate-50 p-5 transition hover:-translate-y-0.5 hover:border-slate-300 hover:bg-white"
            >
              <h2 className="text-lg font-semibold text-slate-900">{role.title}</h2>
              <p className="mt-2 text-sm text-slate-600">{role.subtitle}</p>
              <p className="mt-4 text-sm font-medium text-indigo-700">{role.cta} →</p>
            </Link>
          ))}
        </div>
      </section>
    </main>
  );
}
