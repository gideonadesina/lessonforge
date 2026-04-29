import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PexelsImage } from "@/components/marketing/PexelsImage";
import { blogPosts, getPostBySlug, getRelatedPosts } from "@/lib/blog/posts";

export function generateStaticParams() {
  return blogPosts.map((post) => ({ slug: post.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const post = getPostBySlug(slug);

  if (!post) {
    return { title: "Blog Post Not Found | LessonForge" };
  }

  return {
    title: `${post.title} | LessonForge`,
    description: post.excerpt,
    openGraph: {
      title: post.title,
      description: post.excerpt,
      type: "article",
      images: [{ url: "/og-image.png", width: 1200, height: 630 }],
    },
  };
}

export default async function BlogPostPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const post = getPostBySlug(slug);

  if (!post) notFound();

  const related = getRelatedPosts(post.slug);

  return (
    <main className="bg-[#FBFAFF]">
      <article className="mx-auto max-w-3xl px-4 py-12 sm:px-6 lg:px-8">
        <Link href="/blog" className="text-sm font-black text-[#6C63FF]">
          ← Back to Blog
        </Link>

        <PexelsImage query={post.pexelsQuery} className="mt-8 h-[400px] rounded-xl" />

        <div className="mt-10">
          <span className="rounded-full bg-violet-50 px-3 py-1 text-xs font-black uppercase tracking-[0.16em] text-[#6C63FF]">
            {post.category}
          </span>
          <h1 className="mt-5 text-4xl font-black leading-tight tracking-tight text-slate-950 sm:text-5xl">
            {post.title}
          </h1>
          <div className="mt-6 flex items-center gap-4 border-y border-slate-200 py-4">
            <div className="flex h-11 w-11 items-center justify-center rounded-full bg-[#6C63FF] text-sm font-black text-white">
              {post.author.charAt(0)}
            </div>
            <div className="text-sm">
              <div className="font-black text-slate-950">{post.author}</div>
              <div className="mt-1 text-slate-500">
                {post.date} · {post.readTime}
              </div>
            </div>
          </div>
        </div>

        <div className="mt-10 space-y-6">
          {post.content
            .trim()
            .split("\n")
            .map((line, index) => {
              const text = line.trim();
              if (!text) return null;
              if (text.startsWith("## ")) {
                return (
                  <h2 key={index} className="pt-6 text-2xl font-black tracking-tight text-slate-950">
                    {text.replace("## ", "")}
                  </h2>
                );
              }
              if (text.startsWith("> ")) {
                return (
                  <blockquote
                    key={index}
                    className="border-l-4 border-[#6C63FF] bg-white px-5 py-4 text-lg font-semibold leading-8 text-slate-800 shadow-sm"
                  >
                    {text.replace("> ", "")}
                  </blockquote>
                );
              }
              return (
                <p key={index} className="text-lg leading-8 text-slate-700">
                  {text}
                </p>
              );
            })}
        </div>
      </article>

      <section className="mx-auto max-w-5xl px-4 pb-20 sm:px-6 lg:px-8">
        <h2 className="text-2xl font-black tracking-tight text-slate-950">Related Posts</h2>
        <div className="mt-6 grid gap-6 md:grid-cols-2">
          {related.map((item) => (
            <Link
              key={item.slug}
              href={`/blog/${item.slug}`}
              className="rounded-[24px] border border-slate-200 bg-white p-6 shadow-[0_22px_70px_-54px_rgba(15,23,42,0.65)] transition hover:-translate-y-1 hover:shadow-[0_30px_90px_-52px_rgba(108,99,255,0.85)]"
            >
              <span className="text-xs font-black uppercase tracking-[0.16em] text-[#6C63FF]">
                {item.category}
              </span>
              <h3 className="mt-3 text-xl font-black text-slate-950">{item.title}</h3>
              <p className="mt-3 text-sm leading-6 text-slate-600">{item.excerpt}</p>
            </Link>
          ))}
        </div>
      </section>
    </main>
  );
}
