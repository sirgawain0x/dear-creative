export type DispatchAudioResources = {
  audio: Pick<
    HTMLAudioElement,
    | "pause"
    | "onloadedmetadata"
    | "ontimeupdate"
    | "onended"
    | "onerror"
  > & {
    removeAttribute?: (qualifiedName: string) => void;
    load?: () => void;
    src?: string;
  } | null;
  utterance: Pick<SpeechSynthesisUtterance, "onend" | "onerror"> | null;
  abortController: Pick<AbortController, "abort"> | null;
  speechSynthesis?: Pick<SpeechSynthesis, "cancel"> | null;
};

function revokeBlobSrcIfNeeded(
  audio: NonNullable<DispatchAudioResources["audio"]>,
): void {
  const src = audio.src;
  if (typeof src === "string" && src.startsWith("blob:")) {
    try {
      URL.revokeObjectURL(src);
    } catch {
      // Ignore revoke errors
    }
  }
}

/**
 * Safely tears down active HTMLAudioElement and Web Speech synthesis without
 * triggering spurious `audio.onerror` fallbacks.
 */
export function stopDispatchAudioResources(
  resources: DispatchAudioResources,
): void {
  if (resources.abortController) {
    try {
      resources.abortController.abort();
    } catch {
      // Ignore abort errors
    }
  }

  if (resources.audio) {
    const audio = resources.audio;
    audio.onloadedmetadata = null;
    audio.ontimeupdate = null;
    audio.onended = null;
    audio.onerror = null;
    try {
      revokeBlobSrcIfNeeded(audio);
      audio.pause();
      audio.removeAttribute?.("src");
      audio.load?.();
    } catch {
      // Ignore errors during media teardown
    }
  }

  if (resources.utterance) {
    resources.utterance.onend = null;
    resources.utterance.onerror = null;
  }

  const synth =
    resources.speechSynthesis !== undefined
      ? resources.speechSynthesis
      : typeof window !== "undefined" && "speechSynthesis" in window
        ? window.speechSynthesis
        : null;

  if (synth) {
    try {
      synth.cancel();
    } catch {
      // Ignore errors if speechSynthesis is unavailable
    }
  }
}
