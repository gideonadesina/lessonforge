import React from "react";

import TitleSlide from "@/components/slides/TitleSlide";
import LearningObjectivesSlide from "@/components/slides/LearningObjectivesSlide";
import ConceptSlide from "@/components/slides/ConceptSlide";
import VocabularySlide from "@/components/slides/VocabularySlide";
import WorkedExampleSlide from "@/components/slides/WorkedExampleSlide";
import CheckForUnderstandingSlide from "@/components/slides/CheckForUnderstandingSlide";
import DiscussionSlide from "@/components/slides/DiscussionSlide";
import SummarySlide from "@/components/slides/SummarySlide";
import ExitTicketSlide from "@/components/slides/ExitTicketSlide";

export type TitleSlide = {
  type: "title";
  title: string;
  subtitle?: string;
  hook_question?: string;
  visual_suggestion: string;
  visual_type: "hero";
  image_url?: string | null;
  image?: string | null;
};

export type LearningObjectivesSlide = {
  type: "learning_objectives";
  title: string;
  objectives: string[];
  bloom_level?: string;
  visual_suggestion: string;
  visual_type: "support";
  image_url?: string | null;
  image?: string | null;
};

export type ConceptSlide = {
  type: "concept";
  title: string;
  explanation: string;
  key_point?: string;
  analogy?: string;
  visual_suggestion: string;
  visual_type: "diagram";
  image_url?: string | null;
  image?: string | null;
};

export type VocabularySlide = {
  type: "vocabulary";
  title: string;
  terms: { word: string; definition: string; example?: string }[];
  visual_suggestion: string;
  visual_type: "support";
  image_url?: string | null;
  image?: string | null;
};

export type WorkedExampleSlide = {
  type: "worked_example";
  title: string;
  steps: { step_num: number; instruction: string; tip?: string }[];
  visual_suggestion: string;
  visual_type: "diagram";
  image_url?: string | null;
  image?: string | null;
};

export type CheckForUnderstandingSlide = {
  type: "check_for_understanding";
  question: string;
  choices: { label: string; text: string; is_correct: boolean }[];
  explanation?: string;
  visual_suggestion: string;
  visual_type: "support";
  image_url?: string | null;
  image?: string | null;
};

export type DiscussionSlide = {
  type: "discussion";
  prompt: string;
  guiding_questions?: string[];
  think_pair_share?: boolean;
  visual_suggestion: string;
  visual_type: "support";
  image_url?: string | null;
  image?: string | null;
};

export type SummarySlide = {
  type: "summary";
  title: string;
  takeaways: string[];
  connection_to_next?: string;
  visual_suggestion: string;
  visual_type: "support";
  image_url?: string | null;
  image?: string | null;
};

export type ExitTicketSlide = {
  type: "exit_ticket";
  title: string;
  prompt: string;
  sentence_starters?: string[];
  self_rating?: boolean;
  visual_suggestion: string;
  visual_type: "support";
  image_url?: string | null;
  image?: string | null;
};

export type Slide =
  | TitleSlide
  | LearningObjectivesSlide
  | ConceptSlide
  | VocabularySlide
  | WorkedExampleSlide
  | CheckForUnderstandingSlide
  | DiscussionSlide
  | SummarySlide
  | ExitTicketSlide;

export type SlideDeck = {
  deck_title: string;
  subject: string;
  grade: string;
  bloom_level: string;
  slides: Slide[];
};

function FallbackSlideView({ slide }: { slide: Slide }) {
  const anySlide = slide as { type?: string; title?: string };
  return (
    <div className="flex h-full w-full flex-col items-center justify-center px-16 py-12 text-center">
      <div className="inline-flex items-center gap-2 rounded-full border border-red-200 bg-red-50 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-red-700">
        <span className="h-1.5 w-1.5 rounded-full bg-red-500" />
        Unsupported Slide
      </div>
      <h2 className="mt-5 text-3xl font-semibold tracking-tight text-gray-900">
        {anySlide.title ?? "Slide content"}
      </h2>
      <p className="mt-3 max-w-xl text-sm leading-relaxed text-gray-500">
        This slide type{" "}
        <span className="font-semibold text-gray-700">
          &quot;{anySlide.type ?? "unknown"}&quot;
        </span>{" "}
        is not supported in this version.
      </p>
    </div>
  );
}

export function renderSlide(slide: Slide): React.ReactElement {
  switch (slide.type) {
    case "title":
      return <TitleSlide slide={slide} />;
    case "learning_objectives":
      return <LearningObjectivesSlide slide={slide} />;
    case "concept":
      return <ConceptSlide slide={slide} />;
    case "vocabulary":
      return <VocabularySlide slide={slide} />;
    case "worked_example":
      return <WorkedExampleSlide slide={slide} />;
    case "check_for_understanding":
      return <CheckForUnderstandingSlide slide={slide} />;
    case "discussion":
      return <DiscussionSlide slide={slide} />;
    case "summary":
      return <SummarySlide slide={slide} />;
    case "exit_ticket":
      return <ExitTicketSlide slide={slide} />;
    default:
      return <FallbackSlideView slide={slide as Slide} />;
  }
}

export function getSlideTypeLabel(slide: Slide): string {
  switch (slide.type) {
    case "title":
      return "Title";
    case "learning_objectives":
      return "Learning Objectives";
    case "concept":
      return "Concept";
    case "vocabulary":
      return "Vocabulary";
    case "worked_example":
      return "Worked Example";
    case "check_for_understanding":
      return "Check for Understanding";
    case "discussion":
      return "Discussion";
    case "summary":
      return "Summary";
    case "exit_ticket":
      return "Exit Ticket";
    default:
      return "Slide";
  }
}

export function getSlideHeadline(slide: Slide): string {
  switch (slide.type) {
    case "title":
    case "learning_objectives":
    case "concept":
    case "vocabulary":
    case "worked_example":
    case "summary":
    case "exit_ticket":
      return slide.title;
    case "check_for_understanding":
      return slide.question;
    case "discussion":
      return slide.prompt;
    default:
      return "Slide";
  }
}
