import Link from "next/link";
import { GraduationCap } from "lucide-react";

type LessonForgeWordmarkProps = {
  href?: string | null;
  className?: string;
};

function WordmarkContent() {
  return (
    <>
      <div className="flex h-[44px] w-[44px] items-center justify-center rounded-[14px] bg-gradient-to-br from-[#534AB7] to-[#3D35A0] text-white shadow-[0_4px_14px_rgba(83,74,183,0.35)]">
        <GraduationCap className="h-5 w-5" />
      </div>
      <div className="leading-tight">
        <div
          className="text-[20px] font-bold text-[#1E1B4B]"
          style={{ fontFamily: '"Playfair Display", Georgia, serif' }}
        >
          LessonForge
        </div>
        <div
          className="text-[10px] uppercase text-[#534AB7]"
          style={{ fontFamily: '"Trebuchet MS", sans-serif', letterSpacing: "2.5px" }}
        >
          SCHOOL WORKSPACE
        </div>
      </div>
    </>
  );
}

export default function LessonForgeWordmark({
  href = "/",
  className,
}: LessonForgeWordmarkProps) {
  if (!href) {
    return <div className={`inline-flex items-center gap-3 ${className ?? ""}`}><WordmarkContent /></div>;
  }

  return (
    <Link href={href} className={`inline-flex items-center gap-3 ${className ?? ""}`}>
      <WordmarkContent />
    </Link>
  );
}