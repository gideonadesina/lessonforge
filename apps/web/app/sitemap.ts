import type { MetadataRoute } from "next";

export default function sitemap(): MetadataRoute.Sitemap {
  const lastModified = new Date();

  return [
    {
      url: "https://lessonforge.app",
      lastModified,
      changeFrequency: "weekly",
      priority: 1.0,
    },
    {
      url: "https://lessonforge.app/lesson-plan-generator",
      lastModified,
      changeFrequency: "weekly",
      priority: 0.9,
    },
    {
      url: "https://lessonforge.app/lesson-note-generator",
      lastModified,
      changeFrequency: "weekly",
      priority: 0.9,
    },
    {
      url: "https://lessonforge.app/worksheet-generator",
      lastModified,
      changeFrequency: "weekly",
      priority: 0.9,
    },
    {
      url: "https://lessonforge.app/exam-question-generator",
      lastModified,
      changeFrequency: "weekly",
      priority: 0.9,
    },
    {
      url: "https://lessonforge.app/ai-tools-for-african-teachers",
      lastModified,
      changeFrequency: "weekly",
      priority: 0.9,
    },
    {
      url: "https://lessonforge.app/blog",
      lastModified,
      changeFrequency: "weekly",
      priority: 0.7,
    },
    {
      url: "https://lessonforge.app/blog/how-to-write-a-lesson-plan-nigeria",
      lastModified,
      changeFrequency: "weekly",
      priority: 0.7,
    },
    {
      url: "https://lessonforge.app/blog/waec-lesson-preparation-tips",
      lastModified,
      changeFrequency: "weekly",
      priority: 0.7,
    },
    {
      url: "https://lessonforge.app/blog/ai-tools-for-teachers-africa",
      lastModified,
      changeFrequency: "weekly",
      priority: 0.7,
    },
    {
      url: "https://lessonforge.app/blog/lesson-notes-vs-lesson-plans",
      lastModified,
      changeFrequency: "weekly",
      priority: 0.7,
    },
    {
      url: "https://lessonforge.app/blog/save-time-as-a-teacher-nigeria",
      lastModified,
      changeFrequency: "weekly",
      priority: 0.7,
    },
    {
      url: "https://lessonforge.app/blog/ghana-kenya-lesson-planning-guide",
      lastModified,
      changeFrequency: "weekly",
      priority: 0.7,
    },
  ];
}
