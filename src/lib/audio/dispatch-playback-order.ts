export type DispatchListenBackend =
  | "stored-gemini-mp3"
  | "kokoro-local"
  | "browser-speech-synthesis";

export type DispatchPlaybackCapabilities = {
  storedGeminiMp3Url?: string | null;
  kokoroAvailable: boolean;
  speechSynthesisAvailable: boolean;
};

/**
 * Primary backend when the reader taps Listen (before runtime failures).
 * Order: stored Gemini MP3 → Kokoro → speechSynthesis.
 */
export function resolvePrimaryListenBackend(
  caps: DispatchPlaybackCapabilities,
): DispatchListenBackend {
  if (caps.storedGeminiMp3Url?.trim()) {
    return "stored-gemini-mp3";
  }
  if (caps.kokoroAvailable) {
    return "kokoro-local";
  }
  if (caps.speechSynthesisAvailable) {
    return "browser-speech-synthesis";
  }
  return "browser-speech-synthesis";
}

/**
 * Fallback after Kokoro fails to load or synthesize in the browser.
 */
export function resolveFallbackAfterKokoroFailure(
  speechSynthesisAvailable: boolean,
): DispatchListenBackend | null {
  if (speechSynthesisAvailable) {
    return "browser-speech-synthesis";
  }
  return null;
}

export function hasSpeechSynthesis(windowLike: {
  speechSynthesis?: SpeechSynthesis;
}): boolean {
  return typeof windowLike.speechSynthesis !== "undefined";
}

export function isKokoroRuntimeSupported(): boolean {
  if (typeof window === "undefined") {
    return false;
  }
  return typeof Worker !== "undefined" && typeof AudioContext !== "undefined";
}
