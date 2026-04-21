import OpenAI from "openai";
import type { SupabaseClient } from "@supabase/supabase-js";

type TeachingTipInput = {
  topic: string;
  className: string;
  subject: string;
};

function getOpenAiClient() {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY missing");
  }
  return new OpenAI({ apiKey });
}

export async function generateTeachingTip(input: TeachingTipInput) {
  const client = getOpenAiClient();
  const prompt =
    `You are ForgeGuide, a teaching assistant for Nigerian secondary schools.\n` +
    `Give one practical, specific teaching tip for a teacher about to teach ` +
    `${input.topic} in ${input.subject} to ${input.className} students.\n` +
    `One sentence only. Be concrete, not generic.`;

  const response = await client.responses.create({
    model: "gpt-4.1-mini",
    input: [
      {
        role: "system",
        content: "Return one plain sentence only.",
      },
      {
        role: "user",
        content: prompt,
      },
    ],
    temperature: 0.2,
    max_output_tokens: 120,
  });

  const tip = (response.output_text ?? "").trim();
  if (!tip) {
    throw new Error("Empty teaching tip response");
  }
  return tip.replace(/\s+/g, " ");
}

export function fallbackTeachingTip() {
  return "Begin with a question your students can answer from experience - it activates prior knowledge before new content.";
}

function utcDateOnly(value = new Date()) {
  return value.toISOString().slice(0, 10);
}

export async function getTeachingTip(params: {
  supabase: SupabaseClient;
  userId: string;
  topic: string;
  className: string;
  subject: string;
}) {
  const today = utcDateOnly();
  const normalizedTopic = params.topic.trim();
  const normalizedSubject = params.subject.trim();
  const normalizedClassName = params.className.trim();

  try {
    const { data: cached, error: cachedErr } = await params.supabase
      .from("ai_tip_cache")
      .select("tip_text")
      .eq("user_id", params.userId)
      .eq("topic", normalizedTopic)
      .eq("generated_for_date", today)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!cachedErr && cached?.tip_text) {
      return {
        tip: String(cached.tip_text),
        cached: true,
      };
    }

    const generatedTip = await generateTeachingTip({
      topic: normalizedTopic,
      className: normalizedClassName,
      subject: normalizedSubject,
    });

    const { error: insertErr } = await params.supabase.from("ai_tip_cache").upsert(
      {
        user_id: params.userId,
        topic: normalizedTopic,
        subject: normalizedSubject,
        tip_text: generatedTip,
        generated_for_date: today,
      },
      {
        onConflict: "user_id,topic,generated_for_date",
        ignoreDuplicates: false,
      }
    );

    if (insertErr) {
      return {
        tip: generatedTip,
        cached: false,
      };
    }

    return {
      tip: generatedTip,
      cached: false,
    };
  } catch {
    return {
      tip: fallbackTeachingTip(),
      cached: false,
    };
  }
}
