import {
  BookOpenCheck,
  CalendarClock,
  ClipboardCheck,
  FileStack,
  GraduationCap,
  LayoutTemplate,
  NotebookPen,
  School,
  Sparkles,
  Telescope,
  TimerReset,
} from "lucide-react";
import type {
  Benefit,
  Feature,
  FooterColumn,
  NavLink,
  Testimonial,
} from "@/components/landing/types";

export const navLinks: NavLink[] = [
  { label: "Features", href: "#features" },
  { label: "Solutions", href: "#solutions" },
  { label: "Pricing", href: "#pricing" },
  { label: "Resources", href: "#resources" },
];

export const trustHighlights: string[] = [
  "Built for modern teachers and schools",
  "Aligned with global and local curricula",
  "Designed for WAEC, NECO & Cambridge",
];

export const benefits: Benefit[] = [
  {
    icon: TimerReset,
    title: "Save hours every week",
    description:
      "Automate planning and reclaim preparation time without sacrificing classroom quality.",
  },
  {
    icon: Sparkles,
    title: "Generate materials instantly",
    description:
      "Produce lesson notes, worksheets, activities, and assessments in one workflow.",
  },
  {
    icon: ClipboardCheck,
    title: "Stay curriculum-aligned",
    description:
      "Keep every lesson mapped to your scheme of work and exam requirements.",
  },
  {
    icon: GraduationCap,
    title: "Teach with confidence",
    description:
      "Walk into class with a complete, structured plan and clear learning objectives.",
  },
];

export const features: Feature[] = [
  {
    icon: BookOpenCheck,
    title: "Lesson Plan Generator",
    description: "Create detailed, class-ready lesson plans in seconds.",
  },
  {
    icon: NotebookPen,
    title: "Worksheet Generator",
    description: "Generate printable practice sheets with differentiated difficulty.",
  },
  {
    icon: ClipboardCheck,
    title: "Exam Builder",
    description: "Build quizzes and tests with suggested marking guidance.",
  },
  {
    icon: LayoutTemplate,
    title: "Slides Generator",
    description: "Instantly draft teaching slides with clear visual flow.",
  },
  {
    icon: FileStack,
    title: "Scheme of Work",
    description: "Import your term plan and keep weekly topics on track.",
  },
  {
    icon: CalendarClock,
    title: "Academic Calendar",
    description: "Sync school events, exams, and term dates in one timeline.",
  },
  {
    icon: School,
    title: "Classroom Notes",
    description: "Create concise, well-structured teaching notes for each class.",
  },
  {
    icon: Telescope,
    title: "Assessment Support",
    description: "Get formative checks and progress prompts tailored to your class.",
  },
];

export const teacherBenefits: string[] = [
  "Generate full weekly plans in a few clicks",
  "Reduce burnout with reliable preparation support",
  "Teach with consistent lesson quality across subjects",
  "Reuse, refine, and personalize every output",
];

export const schoolBenefits: string[] = [
  "Standardize planning quality across departments",
  "Improve curriculum coverage and accountability",
  "Support new teachers with built-in planning structure",
  "Track term progress with central visibility",
];

export const testimonials: Testimonial[] = [
  {
    role: "Sample testimonial — Science Teacher",
    school: "Lagos Secondary School",
    quote:
      "LessonForge helps me move from planning to teaching much faster while keeping every lesson aligned to our term goals.",
  },
  {
    role: "Sample testimonial — School Administrator",
    school: "Abuja Learning Academy",
    quote:
      "Our team now works from a shared planning standard. The consistency across classes has improved noticeably.",
  },
  {
    role: "Sample testimonial — Cambridge Coordinator",
    school: "Port Harcourt International College",
    quote:
      "The platform balances speed with quality. It feels purpose-built for serious schools, not generic AI output.",
  },
];

export const footerColumns: FooterColumn[] = [
  {
    title: "Product",
    links: [
      { label: "Overview", href: "#" },
      { label: "Integrations", href: "#" },
      { label: "Roadmap", href: "#" },
    ],
  },
  {
    title: "Features",
    links: [
      { label: "Lesson Planning", href: "#features" },
      { label: "Assessment", href: "#features" },
      { label: "Academic Calendar", href: "#features" },
    ],
  },
  {
    title: "Resources",
    links: [
      { label: "Help Center", href: "#resources" },
      { label: "Teacher Guides", href: "#resources" },
      { label: "Curriculum Templates", href: "#resources" },
    ],
  },
  {
    title: "Company",
    links: [
      { label: "About", href: "#" },
      { label: "Contact", href: "#" },
      { label: "Careers", href: "#" },
    ],
  },
  {
    title: "Legal",
    links: [
      { label: "Privacy", href: "#" },
      { label: "Terms", href: "#" },
      { label: "Security", href: "#" },
    ],
  },
];

export const resourceCards = [
  {
    title: "Curriculum Playbooks",
    description:
      "Download practical implementation guides for WAEC, NECO, and Cambridge teaching teams.",
  },
  {
    title: "Onboarding for Schools",
    description:
      "Launch LessonForge for departments in a structured, low-friction rollout workflow.",
  },
  {
    title: "Teaching Excellence Library",
    description:
      "Access curated resources on planning quality, assessment strategy, and classroom delivery.",
  },
];

export const planningReminders = [
  { week: "Week 3", message: "Quadratic Functions topic reminder" },
  { week: "Week 4", message: "Continuous Assessment window opens" },
  { week: "Week 5", message: "Parent-teacher conference preparation" },
];

export const planningTimeline = [
  {
    label: "Upload Scheme of Work",
    detail: "Map subjects, weekly topics, and expected milestones.",
  },
  {
    label: "Connect Academic Calendar",
    detail: "Include tests, breaks, school events, and reporting dates.",
  },
  {
    label: "Receive Smart Reminders",
    detail: "LessonForge keeps teachers aligned every week.",
  },
];

export const stats = [
  { label: "Lesson generated", value: "12s" },
  { label: "Weekly planning saved", value: "8+ hrs" },
  { label: "Curriculum confidence", value: "High" },
];

export const trustLogos = [
  "Northbridge Academy",
  "Prime Scholars School",
  "BrightPath College",
  "Harmony Learning Group",
];