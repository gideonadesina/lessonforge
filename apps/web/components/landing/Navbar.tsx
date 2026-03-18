import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowRight } from "lucide-react";
import { navLinks } from "@/components/landing/content";

export function Navbar() {
  const [isScrolled, setIsScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => {
      setIsScrolled(window.scrollY > 12);
    };

    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header
      className={`sticky top-0 z-50 border-b transition-all duration-300 ${
        isScrolled
          ? "border-purple-200/70 bg-[#FAF9F6]/85 backdrop-blur-xl"
          : "border-transparent bg-transparent"
      }`}
    >
      <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
        <Link href="/" className="group flex items-center gap-3 text-slate-900">
          <span className="grid h-9 w-9 place-items-center rounded-xl bg-gradient-to-br from-purple-600 to-violet-500 text-white shadow-lg shadow-purple-700/20 transition-transform duration-300 group-hover:scale-105">
            LF
          </span>
          <span className="text-base font-semibold tracking-tight">LessonForge</span>
        </Link>

        <nav className="hidden items-center gap-8 md:flex">
          {navLinks.map((link) => (
            <a
              key={link.label}
              href={link.href}
              className="text-sm font-medium text-slate-700 transition-colors hover:text-purple-700"
            >
              {link.label}
            </a>
          ))}
        </nav>

        <div className="flex items-center gap-2">
          <Link
            href="/login"
            className="rounded-xl px-4 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-white/80 hover:text-slate-900"
          >
            Login
          </Link>
          <a
            href="#pricing"
            className="inline-flex items-center gap-2 rounded-xl bg-purple-700 px-4 py-2 text-sm font-semibold text-white shadow-lg shadow-purple-900/20 transition-all duration-300 hover:-translate-y-0.5 hover:bg-purple-800"
          >
            Start Free
            <ArrowRight className="h-4 w-4" />
          </a>
        </div>
      </div>
    </header>
  );
}
