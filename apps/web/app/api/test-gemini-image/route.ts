import { NextRequest, NextResponse } from "next/server";
import { generateGeminiImage } from "@/lib/ai/gemini-image";

const DEFAULT_PROMPT = `Create a clean textbook-style educational diagram explaining acid rain, with labeled clouds, industrial emissions, sulfur dioxide, nitrogen oxides, rainwater reaction, affected plants, damaged water bodies, and clear arrows showing the process. White or light clean background. Academic classroom style.`;

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json().catch(() => ({} as Record<string, unknown>))) as {
      prompt?: unknown;
    };

    const prompt =
      typeof body.prompt === "string" && body.prompt.trim()
        ? body.prompt.trim()
        : DEFAULT_PROMPT;

    if (!prompt) {
      return NextResponse.json(
        { ok: false, error: "Prompt is required" },
        { status: 400 }
      );
    }

    const result = await generateGeminiImage(prompt);

    if (!result) {
      console.error("Gemini image generation failed for prompt:", prompt.slice(0, 120));
      return NextResponse.json(
        {
          ok: false,
          provider: "gemini",
          prompt,
          error: "Gemini image generation failed or returned no usable response.",
        },
        { status: 500 }
      );
    }

    return NextResponse.json(
      {
        ok: true,
        provider: "gemini",
        prompt,
        result,
      },
      { status: 200 }
    );
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    console.error("Gemini test route error:", errorMessage);
    return NextResponse.json(
      {
        ok: false,
        provider: "gemini",
        error: `Gemini test route error: ${errorMessage}`,
      },
      { status: 500 }
    );
  }
}
