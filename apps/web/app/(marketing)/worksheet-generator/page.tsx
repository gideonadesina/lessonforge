import type { Metadata } from "next";
import { MarketingLandingPage } from "@/components/marketing/MarketingLandingPage";

export const metadata: Metadata = {
  title: "AI Worksheet Generator for Teachers | LessonForge",
  description:
    "Generate ready-to-print worksheets with questions, answers and marking guides. For African teachers and students.",
};

export default function WorksheetGeneratorPage() {
  return (
    <MarketingLandingPage
      hero={{
        headline: "Generate Print-Ready Worksheets in Seconds",
        subheadline:
          "Create differentiated worksheets, answer keys, and marking guides for your exact class level without formatting everything by hand.",
        query: "students worksheet classroom africa",
      }}
      features={[
        {
          icon: "📝",
          title: "Print-Ready Questions",
          description: "Generate neat worksheets with clear instructions and classroom-ready sections.",
        },
        {
          icon: "✅",
          title: "Answer Keys Included",
          description: "Save marking time with instant answers and teacher-facing notes.",
        },
        {
          icon: "🎯",
          title: "Class-Level Difficulty",
          description: "Tune questions for primary, junior secondary, senior secondary, or college.",
        },
        {
          icon: "📚",
          title: "Curriculum Coverage",
          description: "Align practice activities to African and international curriculum expectations.",
        },
        {
          icon: "🔁",
          title: "Multiple Question Types",
          description: "Use MCQs, short answers, fill-in-the-gap, matching, and application tasks.",
        },
        {
          icon: "📱",
          title: "Works on Any Device",
          description: "Create worksheets from your staff room, classroom, or phone.",
        },
      ]}
    />
  );
}
