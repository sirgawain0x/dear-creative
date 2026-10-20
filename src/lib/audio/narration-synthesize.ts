import { synthesizeSpeechWithGoogle } from "@/lib/adam/gemini-studio";
import { synthesizeSpeechWithKokoroServer } from "./kokoro-server-tts";
import {
  getNarrationProvider,
  isGeminiNarrationFallbackEnabled,
} from "./narration-provider";
import { isKokoroServerConfigured } from "./kokoro-server-tts";

export type NarrationSpeechChunk = {
  audioBase64: string;
  mimeType: string;
  provider: string;
};

export async function synthesizeNarrationSpeechChunk(input: {
  text: string;
  voiceName: string;
  fetchFn?: typeof fetch;
  env?: NodeJS.ProcessEnv;
}): Promise<NarrationSpeechChunk> {
  const env = input.env ?? process.env;
  const provider = getNarrationProvider(env);

  if (provider === "gemini") {
    return synthesizeSpeechWithGoogle({
      text: input.text,
      voiceName: input.voiceName,
      fetchFn: input.fetchFn,
    });
  }

  if (!isKokoroServerConfigured(env)) {
    if (isGeminiNarrationFallbackEnabled(env)) {
      return synthesizeSpeechWithGoogle({
        text: input.text,
        voiceName: input.voiceName,
        fetchFn: input.fetchFn,
      });
    }
    throw new Error(
      "Kokoro TTS is not configured and Gemini narration fallback is disabled.",
    );
  }

  try {
    return await synthesizeSpeechWithKokoroServer({
      text: input.text,
      voice: input.voiceName,
      fetchFn: input.fetchFn,
      env,
    });
  } catch (error) {
    if (!isGeminiNarrationFallbackEnabled(env)) {
      throw error;
    }
    const gemini = await synthesizeSpeechWithGoogle({
      text: input.text,
      voiceName: input.voiceName,
      fetchFn: input.fetchFn,
    });
    return {
      ...gemini,
      provider: `${gemini.provider}+kokoro-fallback`,
    };
  }
}
