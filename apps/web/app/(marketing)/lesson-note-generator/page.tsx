import type { Metadata } from "next";
import { MarketingLandingPage } from "@/components/marketing/MarketingLandingPage";

export const metadata: Metadata = {
  title: "AI Lesson Note Generator for African Teachers | LessonForge",
  description:
    "Write detailed, curriculum-aligned lesson notes instantly. Designed for Nigerian and African teachers following NERDC, WAEC and Cambridge syllabi.",
};

export default function LessonNoteGeneratorPage() {
  return (
    <MarketingLandingPage
      hero={{
        headline: "Write Perfect Lesson Notes Instantly",
        subheadline:
          "Stop spending evenings writing lesson notes. LessonForge generates detailed, structured lesson notes aligned to your exact curriculum - in seconds.",
        query: "teacher writing notes africa",
      }}
      features={[
        {
          icon: "📚",
          title: "Detailed Content Coverage",
          description: "Generate structured explanations, examples, teacher prompts, and student summaries.",
        },
        {
          icon: "🌍",
          title: "Curriculum-Aligned",
          description: "Match notes to NERDC, WAEC, Cambridge, and local African curriculum needs.",
        },
        {
          icon: "✏️",
          title: "Fully Editable",
          description: "Adjust depth, tone, examples, and classroom language before export.",
        },
        {
          icon: "📖",
          title: "Nigerian Textbook References",
          description: "Use familiar textbook-style framing and curriculum-friendly terminology.",
        },
        {
          icon: "🧮",
          title: "Worked Examples Included",
          description: "Add solved examples, guided practice, and checks for understanding.",
        },
        {
          icon: "⏱️",
          title: "Done in 30 Seconds",
          description: "Turn a topic into classroom-ready notes before the next period begins.",
        },
      ]}
    />
  );
}
