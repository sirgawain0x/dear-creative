import { synthesizeSpeechWithGoogle } from "@/lib/adam/gemini-studio";
import {
  getNarrationProvider,
  isGeminiNarrationFallbackEnabled,
  KOKORO_NARRATION_VOICE,
} from "./narration-provider";
import {
  isKokoroServerConfigured,
  synthesizeSpeechWithKokoroServer,
} from "./kokoro-server-tts";

export type NarrationSpeechChunk = {
  audioBase64: string;
  mimeType: string;
  provider: string;
};

export const GEMINI_NARRATION_FALLBACK_VOICE = "Puck";

export async function synthesizeNarrationSpeechChunkWithKokoro(input: {
  text: string;
  voiceName: string;
  fetchFn?: typeof fetch;
  signal?: AbortSignal;
  env?: NodeJS.ProcessEnv;
}): Promise<NarrationSpeechChunk> {
  return synthesizeSpeechWithKokoroServer({
    text: input.text,
    voice: input.voiceName,
    fetchFn: input.fetchFn,
    signal: input.signal,
    env: input.env,
  });
}

export async function synthesizeNarrationSpeechChunkWithGemini(input: {
  text: string;
  voiceName?: string;
  fetchFn?: typeof fetch;
  signal?: AbortSignal;
}): Promise<NarrationSpeechChunk> {
  return synthesizeSpeechWithGoogle({
    text: input.text,
    voiceName: input.voiceName ?? GEMINI_NARRATION_FALLBACK_VOICE,
    fetchFn: input.fetchFn,
  });
}

/**
 * Synthesizes every chunk with Kokoro, or the full set with Gemini when primary
 * is gemini / Kokoro is unavailable / Kokoro fails and fallback is enabled.
 * Never mixes providers across chunks in one article.
 */
export async function synthesizeNarrationChunks(input: {
  chunks: string[];
  voiceName: string;
  fetchFn?: typeof fetch;
  signal?: AbortSignal;
  env?: NodeJS.ProcessEnv;
}): Promise<{ parts: NarrationSpeechChunk[]; provider: string }> {
  const env = input.env ?? process.env;
  const provider = getNarrationProvider(env);

  const runGeminiAll = async (reason: string) => {
    const parts: NarrationSpeechChunk[] = [];
    for (const text of input.chunks) {
      const speech = await synthesizeNarrationSpeechChunkWithGemini({
        text,
        voiceName: GEMINI_NARRATION_FALLBACK_VOICE,
        fetchFn: input.fetchFn,
        signal: input.signal,
      });
      parts.push({
        ...speech,
        provider:
          reason === "primary"
            ? speech.provider
            : `${speech.provider}+kokoro-fallback`,
      });
    }
    const label =
      reason === "primary"
        ? parts[0]?.provider ?? "gemini"
        : `${parts[0]?.provider ?? "gemini"}+kokoro-fallback`;
    return { parts, provider: label };
  };

  if (provider === "gemini") {
    return runGeminiAll("primary");
  }

  if (!isKokoroServerConfigured(env)) {
    if (isGeminiNarrationFallbackEnabled(env)) {
      return runGeminiAll("fallback");
    }
    throw new Error(
      "Kokoro TTS is not configured and Gemini narration fallback is disabled.",
    );
  }

  try {
    const parts: NarrationSpeechChunk[] = [];
    for (const text of input.chunks) {
      const speech = await synthesizeNarrationSpeechChunkWithKokoro({
        text,
        voiceName: input.voiceName || KOKORO_NARRATION_VOICE,
        fetchFn: input.fetchFn,
        signal: input.signal,
        env,
      });
      parts.push(speech);
    }
    return { parts, provider: "kokoro-cloud-run" };
  } catch (error) {
    if (!isGeminiNarrationFallbackEnabled(env)) {
      throw error;
    }
    return runGeminiAll("fallback");
  }
}
