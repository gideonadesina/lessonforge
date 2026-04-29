import type { Metadata } from "next";
import { MarketingLandingPage } from "@/components/marketing/MarketingLandingPage";

export const metadata: Metadata = {
  title: "AI Lesson Plan Generator for African Teachers | LessonForge",
  description:
    "Generate complete, curriculum-aligned lesson plans in seconds. Built for Nigerian, Ghanaian, Kenyan and African teachers. Supports NERDC, WAEC, Cambridge and more.",
};

export default function LessonPlanGeneratorPage() {
  return (
    <MarketingLandingPage
      hero={{
        headline: "Generate a Complete Lesson Plan in 30 Seconds",
        subheadline:
          "Built for African teachers. Aligned to NERDC, WAEC, NECO, Cambridge, and your local curriculum. No more hours wasted writing lesson notes from scratch.",
        query: "african teacher classroom",
      }}
      features={[
        {
          icon: "📦",
          title: "Complete Lesson Pack",
          description: "Lesson plan, notes, slides, quiz, and activities generated in one click.",
        },
        {
          icon: "🌍",
          title: "African Curriculum Aligned",
          description: "Supports NERDC, WAEC, NECO, Cambridge, GES Ghana, and KNEC Kenya.",
        },
        {
          icon: "⚡",
          title: "Ready in 30 Seconds",
          description: "No prompting and no ChatGPT back and forth. Just choose your lesson details.",
        },
        {
          icon: "🖥️",
          title: "Lesson Slides Included",
          description: "Create beautiful Gamma-style presentation slides alongside the lesson plan.",
        },
        {
          icon: "✏️",
          title: "Editable Output",
          description: "Refine every section before downloading or sharing with your class.",
        },
        {
          icon: "📱",
          title: "Works on Any Device",
          description: "Plan from your phone, tablet, or laptop without losing quality.",
        },
      ]}
      example
    />
  );
}
