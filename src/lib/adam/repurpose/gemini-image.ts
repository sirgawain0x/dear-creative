import {
  REPURPOSE_GEMINI_FETCH_TIMEOUT_MS,
  REPURPOSE_MAX_INFOGRAPHIC_BYTES,
} from "./constants";

/** Nano Banana 2.1 — current stable id from ai.google.dev/gemini-api/docs/models */
export const REPURPOSE_INFOGRAPHIC_MODEL = "gemini-nano-banana-2.1";

function getGeminiApiKey(): string | null {
  return (
    process.env.GEMINI_API_KEY?.trim() ||
    process.env.GOOGLE_API_KEY?.trim() ||
    process.env.GOOGLE_GENAI_API_KEY?.trim() ||
    null
  );
}

function extractImageFromGeminiResponse(data: unknown): {
  imageBase64: string;
  mimeType: string;
} | null {
  if (!data || typeof data !== "object") return null;
  const payload = data as {
    candidates?: Array<{
      content?: {
        parts?: Array<{
          inlineData?: { mimeType?: string; data?: string };
        }>;
      };
    }>;
  };
  const parts = payload.candidates?.[0]?.content?.parts ?? [];
  for (const part of parts) {
    if (part.inlineData?.data) {
      return {
        imageBase64: part.inlineData.data,
        mimeType: part.inlineData.mimeType || "image/png",
      };
    }
  }
  return null;
}

export async function generateRepurposeInfographicImage(input: {
  title: string;
  plainText: string;
  fetchFn?: typeof fetch;
  timeoutMs?: number;
}): Promise<{ imageBase64: string; mimeType: string; model: string }> {
  const apiKey = getGeminiApiKey();
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY is not configured on the server.");
  }

  const model =
    process.env.REPURPOSE_INFOGRAPHIC_MODEL?.trim() || REPURPOSE_INFOGRAPHIC_MODEL;
  const fetchImpl = input.fetchFn ?? fetch;
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(
    model,
  )}:generateContent`;
  const timeoutMs = input.timeoutMs ?? REPURPOSE_GEMINI_FETCH_TIMEOUT_MS;

  const prompt = `Create a vertical infographic summarizing this article for social sharing.
Title: ${input.title}
Key material:
${input.plainText.slice(0, 8000)}
Use bold typography, clear sections, and a modern editorial palette. No watermarks.`;

  const response = await fetchImpl(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-goog-api-key": apiKey,
    },
    body: JSON.stringify({
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      generationConfig: {
        responseModalities: ["TEXT", "IMAGE"],
      },
    }),
    signal: AbortSignal.timeout(timeoutMs),
  });

  if (!response.ok) {
    throw new Error(`Infographic image generation failed (${response.status})`);
  }

  const json = await response.json();
  const extracted = extractImageFromGeminiResponse(json);
  if (!extracted) {
    throw new Error("Infographic model returned no image");
  }

  const byteLength = Buffer.byteLength(extracted.imageBase64, "base64");
  if (byteLength > REPURPOSE_MAX_INFOGRAPHIC_BYTES) {
    throw new Error(
      `Infographic image exceeds size limit (${byteLength} bytes)`,
    );
  }

  return { ...extracted, model };
}
