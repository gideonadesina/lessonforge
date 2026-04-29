import type { Metadata } from "next";
import { MarketingLandingPage } from "@/components/marketing/MarketingLandingPage";

export const metadata: Metadata = {
  title: "AI Exam Question Generator for African Teachers | LessonForge",
  description:
    "Generate WAEC, NECO and curriculum-aligned exam questions with marking schemes instantly. Trusted by African teachers.",
};

export default function ExamQuestionGeneratorPage() {
  return (
    <MarketingLandingPage
      hero={{
        headline: "Generate Exam Questions With Marking Schemes Instantly",
        subheadline:
          "Build balanced tests, practice papers, and revision questions aligned to WAEC, NECO, Cambridge, and your school scheme of work.",
        query: "exam students africa school",
      }}
      features={[
        {
          icon: "🧾",
          title: "Marking Schemes Included",
          description: "Generate answers, rubrics, and teacher notes alongside every question set.",
        },
        {
          icon: "🎓",
          title: "WAEC & NECO Style",
          description: "Create objective, theory, and application questions that match exam expectations.",
        },
        {
          icon: "⚖️",
          title: "Balanced Difficulty",
          description: "Mix recall, understanding, application, and higher-order thinking questions.",
        },
        {
          icon: "📊",
          title: "Ready for Revision",
          description: "Turn any topic into weekly tests, mock exams, or targeted revision drills.",
        },
        {
          icon: "✏️",
          title: "Editable Before Export",
          description: "Review, improve, and localize wording before sharing with students.",
        },
        {
          icon: "⏱️",
          title: "Done in 30 Seconds",
          description: "Create assessment materials faster without sacrificing quality.",
        },
      ]}
    />
  );
}
