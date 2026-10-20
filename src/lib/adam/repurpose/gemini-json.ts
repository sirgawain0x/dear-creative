import { REPURPOSE_GEMINI_FETCH_TIMEOUT_MS } from "./constants";
import { getRepurposeGenerationPrompt, getRepurposeResponseSchema } from "./schemas";
import type { RepurposeOutputType } from "./types";
import { validateRepurposeModelOutput } from "./validate-output";

function getGeminiApiKey(): string | null {
  return (
    process.env.GEMINI_API_KEY?.trim() ||
    process.env.GOOGLE_API_KEY?.trim() ||
    process.env.GOOGLE_GENAI_API_KEY?.trim() ||
    null
  );
}

function getRepurposeTextModel(): string {
  return (
    process.env.REPURPOSE_GEMINI_MODEL?.trim() ||
    process.env.ADAM_GEMINI_MODEL?.trim() ||
    "gemini-3.8-flash"
  );
}

export async function generateRepurposeStructuredJson(input: {
  outputType: RepurposeOutputType;
  source: { title: string; plainText: string };
  fetchFn?: typeof fetch;
  timeoutMs?: number;
}): Promise<unknown> {
  const apiKey = getGeminiApiKey();
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY is not configured on the server.");
  }

  const fetchImpl = input.fetchFn ?? fetch;
  const model = getRepurposeTextModel();
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(
    model,
  )}:generateContent`;

  const schema = getRepurposeResponseSchema(input.outputType);
  const prompt = getRepurposeGenerationPrompt(input.outputType, input.source);
  const timeoutMs = input.timeoutMs ?? REPURPOSE_GEMINI_FETCH_TIMEOUT_MS;

  const generationConfig: Record<string, unknown> = {
    responseMimeType: "application/json",
    temperature: 0.4,
  };
  if (input.outputType === "mind_map") {
    generationConfig.responseJsonSchema = schema;
  } else {
    generationConfig.responseSchema = schema;
  }

  const response = await fetchImpl(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-goog-api-key": apiKey,
    },
    body: JSON.stringify({
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      generationConfig,
    }),
    signal: AbortSignal.timeout(timeoutMs),
  });

  if (!response.ok) {
    throw new Error(`Gemini structured generation failed (${response.status})`);
  }

  const data = (await response.json()) as {
    candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
  };
  const rawText = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
  if (!rawText) {
    throw new Error("Empty structured response from Gemini");
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(rawText) as unknown;
  } catch {
    throw new Error("Gemini returned invalid JSON");
  }

  return validateRepurposeModelOutput(input.outputType, parsed);
}
