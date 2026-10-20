export type NarrationProvider = "kokoro" | "gemini";

const PROVIDER_ENV = "NARRATION_PROVIDER";
const GEMINI_FALLBACK_ENV = "NARRATION_GEMINI_FALLBACK";

export function getNarrationProvider(
  env: NodeJS.ProcessEnv = process.env,
): NarrationProvider {
  const raw = env[PROVIDER_ENV]?.trim().toLowerCase();
  if (raw === "gemini") {
    return "gemini";
  }
  return "kokoro";
}

/** When primary is Kokoro, allow Gemini TTS if Kokoro fails (requires server Gemini config). */
export function isGeminiNarrationFallbackEnabled(
  env: NodeJS.ProcessEnv = process.env,
): boolean {
  if (getNarrationProvider(env) === "gemini") {
    return true;
  }
  return env[GEMINI_FALLBACK_ENV]?.trim().toLowerCase() === "true";
}

export const KOKORO_NARRATION_VOICE = "af_heart";

export function defaultNarrationVoice(
  env: NodeJS.ProcessEnv = process.env,
): string {
  return getNarrationProvider(env) === "gemini" ? "Puck" : KOKORO_NARRATION_VOICE;
}

/** Next.js publish/audio routes use maxDuration=300; stay below that for outbound Kokoro calls. */
export function getKokoroTtsTimeoutMs(
  env: NodeJS.ProcessEnv = process.env,
): number {
  const raw = env.KOKORO_TTS_TIMEOUT_MS?.trim();
  if (raw) {
    const parsed = Number.parseInt(raw, 10);
    if (Number.isFinite(parsed) && parsed > 0) {
      return parsed;
    }
  }
  return 240_000;
}

export const NEXT_ROUTE_MAX_DURATION_SEC = 300;
