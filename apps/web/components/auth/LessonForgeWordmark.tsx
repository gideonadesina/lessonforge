import Link from "next/link";

export default function LessonForgeWordmark({ href = "/" }: { href?: string }) {
  return (
    <Link href={href} className="inline-flex items-center gap-3">
      <div className="h-11 w-11 rounded-2xl bg-gradient-to-br from-violet-700 to-indigo-600 shadow-[0_10px_35px_-18px_rgba(79,70,229,0.8)]" />
      <div className="leading-tight">
        <div className="text-xl font-semibold tracking-tight text-slate-900">
          LessonForge
        </div>
        <div className="text-xs font-medium uppercase tracking-[0.22em] text-violet-700/80">
          School Workspace
        </div>
      </div>
    </Link>
  );
}
