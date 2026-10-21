import { mayContinuePlayback } from "@/lib/audio/may-continue-playback";

export type PlayAdamGoogleTtsParams = {
  text: string;
  messageIndex: number;
  isSessionActive: () => boolean;
  fetchTts: (signal: AbortSignal) => Promise<Response>;
  speakBrowserFallback: (text: string, messageIndex: number) => void;
  onAudioCreated: (audio: HTMLAudioElement) => void;
  abortRef: { current: AbortController | null };
};

export async function playAdamGoogleTts({
  text,
  messageIndex,
  isSessionActive,
  fetchTts,
  speakBrowserFallback,
  onAudioCreated,
  abortRef,
}: PlayAdamGoogleTtsParams): Promise<void> {
  const ttsAbort = new AbortController();
  abortRef.current = ttsAbort;

  const tryFallback = () => {
    if (!mayContinuePlayback(isSessionActive(), ttsAbort.signal.aborted)) {
      return;
    }
    speakBrowserFallback(text, messageIndex);
  };

  try {
    const res = await fetchTts(ttsAbort.signal);
    if (!mayContinuePlayback(isSessionActive(), ttsAbort.signal.aborted)) {
      return;
    }

    if (!res.ok) {
      tryFallback();
      return;
    }

    const data = (await res.json()) as {
      audioBase64?: string;
      mimeType?: string;
    };
    if (!mayContinuePlayback(isSessionActive(), ttsAbort.signal.aborted)) {
      return;
    }
    if (!data.audioBase64) {
      tryFallback();
      return;
    }

    const audio = new Audio(
      `data:${data.mimeType || "audio/wav"};base64,${data.audioBase64}`,
    );
    onAudioCreated(audio);
    if (abortRef.current === ttsAbort) {
      abortRef.current = null;
    }

    audio.onerror = () => {
      if (!mayContinuePlayback(isSessionActive(), ttsAbort.signal.aborted)) {
        return;
      }
      tryFallback();
    };

    await audio.play();
  } catch {
    if (!mayContinuePlayback(isSessionActive(), ttsAbort.signal.aborted)) {
      return;
    }
    tryFallback();
  } finally {
    if (abortRef.current === ttsAbort) {
      abortRef.current = null;
    }
  }
}
