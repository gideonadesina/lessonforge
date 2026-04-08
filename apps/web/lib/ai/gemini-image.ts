import { GoogleGenAI } from "@google/genai";

const GEMINI_API_KEY =
  process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;

if (!GEMINI_API_KEY) {
  console.warn(
    "Gemini helper warning: GEMINI_API_KEY or GOOGLE_API_KEY is not configured."
  );
}

const ai = new GoogleGenAI({
  apiKey: GEMINI_API_KEY,
});

export async function generateGeminiImage(prompt: string) {
  try {
    const response = await ai.models.generateContent({
      model: "gemini-3.1-flash-image-preview",
      contents: prompt,
      config: {
        responseModalities: ["Image"],
      },
    });

    const parts = response.candidates?.[0]?.content?.parts ?? [];

    for (const part of parts) {
      if (part.inlineData?.data) {
        return {
          mimeType: part.inlineData.mimeType ?? "image/png",
          base64: part.inlineData.data,
        };
      }
    }

    const text = parts
      .map((part) => (typeof part.text === "string" ? part.text : ""))
      .filter(Boolean)
      .join("\n");

    if (text) {
      return { text };
    }

    console.error("No image or text in Gemini response");
    return null;
  } catch (err) {
    console.error("Gemini image error:", err);
    return null;
  }
}