import OpenAI from "openai";
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { buildForgeGuideSystemPrompt } from "@/lib/forgeguide/system-prompts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

type ForgeGuideMessage = {
  role: "user" | "assistant";
  content: string;
};

type ForgeGuidePayload = {
  message: string;
  teacherName?: string;
  userEmail?: string;

  // old style
  pageContext?: string;
  lessonContext?: any;

  // new style
  context?: {
    page?: string;
    teacherName?: string;
    credits?: number;
    plan?: string;
    recentLessons?: any[];
    currentLesson?: any;
  };

  history?: ForgeGuideMessage[];
};

export async function POST(req: NextRequest) {
  try {
    const auth = req.headers.get("authorization") ?? "";
    const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";

    if (!token) {
      return NextResponse.json(
        { error: "Unauthorized (no token)" },
        { status: 401 }
      );
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        auth: {
          persistSession: false,
          autoRefreshToken: false,
          detectSessionInUrl: false,
        },
        global: { headers: { Authorization: `Bearer ${token}` } },
      }
    );

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: "Unauthorized (invalid token)", message: authError?.message },
        { status: 401 }
      );
    }

    let body: ForgeGuidePayload;
    try {
      body = (await req.json()) as ForgeGuidePayload;
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    const message = body?.message?.trim();
    if (!message) {
      return NextResponse.json(
        { error: "Message is required" },
        { status: 400 }
      );
    }

    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json(
        { error: "OPENAI_API_KEY missing" },
        { status: 500 }
      );
    }

    const teacherName =
      body.teacherName?.trim() ||
      body.context?.teacherName?.trim() ||
      user.user_metadata?.full_name ||
      user.user_metadata?.name ||
      user.email?.split("@")[0] ||
      "Teacher";

    const safeHistory = Array.isArray(body.history)
      ? body.history
          .filter(
            (m) =>
              m &&
              (m.role === "user" || m.role === "assistant") &&
              typeof m.content === "string" &&
              m.content.trim()
          )
          .slice(-8)
      : [];

    const pageContext =
      body.context?.page ||
      body.pageContext ||
      "dashboard";

    const lessonContext =
      body.context?.currentLesson ||
      body.lessonContext ||
      null;

    const recentLessonsText =
      Array.isArray(body.context?.recentLessons) && body.context!.recentLessons.length
        ? `Recent lessons:
${JSON.stringify(body.context?.recentLessons, null, 2)}`
        : "No recent lessons attached.";

    const dashboardContextText = body.context
      ? `App context:
${JSON.stringify(body.context, null, 2)}`
      : "No app context attached.";

    const lessonContextText = lessonContext
      ? `Current lesson context:
${JSON.stringify(lessonContext, null, 2)}`
      : "No lesson context is currently attached.";

    const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

    const input: Array<{
      role: "system" | "user" | "assistant";
      content: string;
    }> = [
      {
        role: "system",
        content: buildForgeGuideSystemPrompt({
          teacherName,
          pageContext,
        }),
      },
      {
        role: "user",
        content: `Teacher name: ${teacherName}
Teacher email: ${body.userEmail || user.email || ""}

${dashboardContextText}

${recentLessonsText}

${lessonContextText}`,
      },
      ...safeHistory.map((m) => ({
        role: m.role,
        content: m.content,
      })),
      {
        role: "user",
        content: message,
      },
    ];

    const resp = await client.responses.create({
      model: "gpt-4.1-mini",
      input,
      max_output_tokens: 700,
    });

    const reply = (resp.output_text || "").trim();

    if (!reply) {
      return NextResponse.json(
        { error: "ForgeGuide returned an empty response" },
        { status: 502 }
      );
    }

    return NextResponse.json({
      reply,
      teacherName,
    });
  } catch (err: any) {
    console.error("❌ ForgeGuide error:", err);
    return NextResponse.json(
      { error: "ForgeGuide failed", message: err?.message ?? String(err) },
      { status: 500 }
    );
  }
}