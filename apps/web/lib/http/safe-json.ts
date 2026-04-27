export type SafeJsonResult<T = unknown> = {
  data: T | null;
  text: string;
  parseError: string | null;
};

export async function readJsonResponse<T = unknown>(
  response: Response
): Promise<SafeJsonResult<T>> {
  const text = await response.text();

  if (!text.trim()) {
    return { data: null, text, parseError: null };
  }

  try {
    return { data: JSON.parse(text) as T, text, parseError: null };
  } catch (error) {
    return {
      data: null,
      text,
      parseError: error instanceof Error ? error.message : "Invalid JSON",
    };
  }
}

export function getInvalidJsonMessage(response: Response) {
  if (response.status === 401) {
    return "Session expired. Please login again.";
  }

  if (response.status === 402) {
    return "Not enough credits to complete this generation.";
  }

  if (response.status >= 500) {
    return "The server returned an invalid response. Please try again.";
  }

  return "We could not read the server response. Please try again.";
}
