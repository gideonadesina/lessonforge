import type { Metadata } from "next";
import { MarketingLandingPage } from "@/components/marketing/MarketingLandingPage";

export const metadata: Metadata = {
  title: "AI Tools for African Teachers | LessonForge",
  description:
    "The #1 AI platform built specifically for African teachers. Generate lesson plans, lesson notes, slides, worksheets and exams aligned to Nigerian, Ghanaian, Kenyan and other African curricula.",
};

export default function AiToolsForAfricanTeachersPage() {
  return (
    <MarketingLandingPage
      hero={{
        headline: "The AI Platform Built for African Teachers",
        subheadline:
          "Not American. Not British. Built for YOU - Nigerian, Ghanaian, Kenyan, Ugandan, South African teachers. Aligned to your curriculum. Uses your examples. Knows your textbooks.",
        query: "african teachers school classroom",
      }}
      features={[
        {
          icon: "📋",
          title: "Lesson Plans",
          description: "Generate structured plans with objectives, prior knowledge, activities, and evaluation.",
        },
        {
          icon: "📚",
          title: "Lesson Notes",
          description: "Create detailed teacher notes with examples and student-friendly explanations.",
        },
        {
          icon: "🖥️",
          title: "Lesson Slides",
          description: "Build presentation-ready slides for classroom teaching and revision.",
        },
        {
          icon: "📝",
          title: "Worksheets",
          description: "Generate classroom practice with answers and differentiated question styles.",
        },
        {
          icon: "🎓",
          title: "Exams",
          description: "Create exam questions and marking schemes aligned to local standards.",
        },
        {
          icon: "🌍",
          title: "African Context",
          description: "Use local examples, curricula, textbook references, and classroom realities.",
        },
      ]}
      countries={[
        "🇳🇬 Nigeria",
        "🇬🇭 Ghana",
        "🇰🇪 Kenya",
        "🇺🇬 Uganda",
        "🇿🇦 South Africa",
        "🇹🇿 Tanzania",
        "🇷🇼 Rwanda",
        "🇸🇳 Senegal",
        "🇨🇮 Côte d'Ivoire",
        "🇪🇹 Ethiopia",
      ]}
      curricula={[
        "NERDC",
        "WAEC",
        "NECO",
        "Cambridge",
        "GES Ghana",
        "KNEC Kenya",
        "UNEB Uganda",
        "DBE South Africa",
      ]}
      example
    />
  );
}
