import { getInvalidJsonMessage, readJsonResponse } from "@/lib/http/safe-json";

type EnrichImagesResponse<T> = {
  ok?: boolean;
  data?: T;
  warning?: {
    code?: string;
    message?: string;
  };
};

export async function enrichGeneratedLessonImages<T>(
  token: string,
  lessonId: string,
  fallbackData: T,
  logPrefix = "generate"
) {
  if (!lessonId) return fallbackData;

  try {
    const res = await fetch("/api/generate/enrich-images", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ lessonId }),
    });

    const parsedResponse = await readJsonResponse<EnrichImagesResponse<T>>(res);
    if (parsedResponse.parseError) {
      throw new Error(getInvalidJsonMessage(res));
    }

    const json = parsedResponse.data ?? {};
    if (json.warning?.message) {
      console.warn(`[${logPrefix}] Image enrichment warning:`, json.warning.message);
    }

    if (res.ok && json.data) {
      return json.data;
    }
  } catch (error) {
    console.warn(`[${logPrefix}] Image enrichment skipped:`, error);
  }

  return fallbackData;
}
