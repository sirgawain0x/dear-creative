export type DispatchListenBackend = "stored-mp3" | "browser-speech-synthesis";

export type DispatchPlaybackCapabilities = {
  storedMp3Url?: string | null;
  speechSynthesisAvailable: boolean;
};

/**
 * Reader playback order: stored narration MP3 → browser speechSynthesis.
 */
export function resolvePrimaryListenBackend(
  caps: DispatchPlaybackCapabilities,
): DispatchListenBackend {
  if (caps.storedMp3Url?.trim()) {
    return "stored-mp3";
  }
  return "browser-speech-synthesis";
}

export function hasSpeechSynthesis(windowLike: {
  speechSynthesis?: SpeechSynthesis;
}): boolean {
  return typeof windowLike.speechSynthesis !== "undefined";
}
