import type { Metadata } from "next";
import Link from "next/link";
import { PexelsImage } from "@/components/marketing/PexelsImage";
import { blogPosts } from "@/lib/blog/posts";

export const metadata: Metadata = {
  title: "Blog - Tips & Resources for African Teachers | LessonForge",
  description: "Practical guides for African teachers using AI to plan lessons, write notes, create worksheets, and prepare students for exams.",
};

export default function BlogPage() {
  return (
    <main className="bg-[#FBFAFF]">
      <section className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-3xl text-center">
          <div className="text-sm font-black uppercase tracking-[0.22em] text-[#6C63FF]">
            LessonForge Blog
          </div>
          <h1 className="mt-4 text-5xl font-black tracking-tight text-slate-950 sm:text-6xl">
            Teaching Resources & Tips
          </h1>
          <p className="mt-5 text-lg leading-8 text-slate-600">
            Practical guides for African teachers.
          </p>
        </div>

        <div className="mt-14 grid gap-7 md:grid-cols-2 lg:grid-cols-3">
          {blogPosts.map((post) => (
            <article
              key={post.slug}
              className="group overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-[0_22px_70px_-54px_rgba(15,23,42,0.65)] transition hover:-translate-y-1 hover:shadow-[0_30px_90px_-52px_rgba(108,99,255,0.85)]"
            >
              <PexelsImage query={post.pexelsQuery} className="h-56" />
              <div className="p-6">
                <span className="rounded-full bg-violet-50 px-3 py-1 text-xs font-black uppercase tracking-[0.16em] text-[#6C63FF]">
                  {post.category}
                </span>
                <h2 className="mt-4 text-xl font-black leading-tight text-slate-950">
                  {post.title}
                </h2>
                <p className="mt-3 text-sm leading-6 text-slate-600">{post.excerpt}</p>
                <div className="mt-5 flex items-center justify-between text-xs font-semibold text-slate-500">
                  <span>{post.author}</span>
                  <span>{post.readTime}</span>
                </div>
                <Link
                  href={`/blog/${post.slug}`}
                  className="mt-6 inline-flex text-sm font-black text-[#6C63FF] transition group-hover:translate-x-1"
                >
                  Read More →
                </Link>
              </div>
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}
