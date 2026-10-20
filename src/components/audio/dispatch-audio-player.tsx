"use client";

import { useCallback, useLayoutEffect, useRef, useState } from "react";
import {
  hasSpeechSynthesis,
  isKokoroRuntimeSupported,
  resolveFallbackAfterKokoroFailure,
  resolvePrimaryListenBackend,
  type DispatchListenBackend,
} from "@/lib/audio/dispatch-playback-order";
import { KokoroPlaybackSession } from "@/lib/audio/kokoro-client";
import { KOKORO_DEFAULT_VOICE } from "@/lib/audio/kokoro-config";
import { stripHtmlTags } from "@/lib/posts/reading-time";

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
  } | null;
  utterance: Pick<SpeechSynthesisUtterance, "onend" | "onerror"> | null;
  abortController: Pick<AbortController, "abort"> | null;
  speechSynthesis?: Pick<SpeechSynthesis, "cancel"> | null;
  kokoroSession?: { stop: () => Promise<void> } | null;
};

/**
 * Safely tears down active HTMLAudioElement, Kokoro, Web Speech synthesis, and
 * in-flight requests without triggering spurious `audio.onerror` fallbacks.
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

  if (resources.kokoroSession) {
    void resources.kokoroSession.stop();
  }

  if (resources.audio) {
    const audio = resources.audio;
    audio.onloadedmetadata = null;
    audio.ontimeupdate = null;
    audio.onended = null;
    audio.onerror = null;
    try {
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

type DispatchAudioPlayerProps = {
  slug: string;
  title: string;
  excerpt?: string | null;
  bodyHtml?: string | null;
  listenMinutes?: number;
  /** Pre-generated narration MP3 on Lens Grove; when set, readers stream it with no live TTS. */
  audioUrl?: string | null;
  /** Voice the author selected when generating `audioUrl`. */
  audioVoice?: string | null;
};

function formatLoadProgress(info: {
  status: string;
  file?: string;
  progress?: number;
  loaded?: number;
  total?: number;
}): string {
  if (info.status === "progress" && info.total && info.loaded !== undefined) {
    const pct = Math.round((info.loaded / info.total) * 100);
    const mb = (info.total / (1024 * 1024)).toFixed(1);
    return `Downloading Kokoro model (${pct}% of ${mb} MB)…`;
  }
  if (info.file) {
    return `Loading ${info.file}…`;
  }
  return "Loading Kokoro voice model…";
}

export function DispatchAudioPlayer({
  slug,
  title,
  excerpt,
  bodyHtml,
  listenMinutes = 2,
  audioUrl,
  audioVoice,
}: DispatchAudioPlayerProps) {
  const staticAudioSrc = audioUrl?.trim() || null;
  const narratorName = audioVoice?.trim() || "Narrator";
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [playbackRate, setPlaybackRate] = useState<1 | 1.25 | 1.5>(1);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(listenMinutes * 60);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [activeBackend, setActiveBackend] =
    useState<DispatchListenBackend | null>(null);
  const [kokoroDevice, setKokoroDevice] = useState<"webgpu" | "wasm" | null>(
    null,
  );

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const kokoroSessionRef = useRef<KokoroPlaybackSession | null>(null);
  const kokoroTickRef = useRef<number | null>(null);
  const playLiveNarrationRef = useRef<(() => Promise<void>) | null>(null);
  const isActiveRef = useRef(true);

  const plainText = `${title}. ${excerpt ? excerpt + ". " : ""}${stripHtmlTags(bodyHtml ?? "")}`;

  const stopKokoroTick = useCallback(() => {
    if (kokoroTickRef.current !== null) {
      window.clearInterval(kokoroTickRef.current);
      kokoroTickRef.current = null;
    }
  }, []);

  const stopAllPlayback = useCallback(() => {
    stopKokoroTick();
    stopDispatchAudioResources({
      audio: audioRef.current,
      utterance: utteranceRef.current,
      abortController: abortControllerRef.current,
      kokoroSession: kokoroSessionRef.current,
    });
    audioRef.current = null;
    utteranceRef.current = null;
    abortControllerRef.current = null;
    kokoroSessionRef.current = null;
    setIsPlaying(false);
    setIsLoading(false);
    setStatusMessage(null);
    setActiveBackend(null);
    setCurrentTime(0);
  }, [stopKokoroTick]);

  useLayoutEffect(() => {
    isActiveRef.current = true;

    const handlePageLeave = () => {
      isActiveRef.current = false;
      stopAllPlayback();
    };

    const handleDocumentClick = (event: MouseEvent) => {
      if (
        event.defaultPrevented ||
        event.button !== 0 ||
        event.metaKey ||
        event.ctrlKey ||
        event.shiftKey ||
        event.altKey
      ) {
        return;
      }
      const target = event.target as HTMLElement | null;
      const anchor = target?.closest?.("a[href]") as HTMLAnchorElement | null;
      if (!anchor) return;
      if (anchor.target && anchor.target !== "_self") return;
      if (anchor.hasAttribute("download")) return;

      try {
        const destUrl = new URL(anchor.href, window.location.href);
        if (
          destUrl.origin === window.location.origin &&
          destUrl.pathname !== window.location.pathname
        ) {
          isActiveRef.current = false;
          stopAllPlayback();
        }
      } catch {
        // Ignore malformed URLs
      }
    };

    window.addEventListener("pagehide", handlePageLeave);
    window.addEventListener("beforeunload", handlePageLeave);
    window.addEventListener("popstate", handlePageLeave);
    document.addEventListener("click", handleDocumentClick, true);

    return () => {
      isActiveRef.current = false;
      window.removeEventListener("pagehide", handlePageLeave);
      window.removeEventListener("beforeunload", handlePageLeave);
      window.removeEventListener("popstate", handlePageLeave);
      document.removeEventListener("click", handleDocumentClick, true);
      stopAllPlayback();
    };
  }, [slug, stopAllPlayback]);

  const fallbackToBrowserSpeech = useCallback(() => {
    if (!isActiveRef.current) return;

    setActiveBackend("browser-speech-synthesis");
    setStatusMessage(null);
    setIsLoading(false);

    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(plainText);
      utterance.rate = playbackRate;

      utterance.onend = () => {
        setIsPlaying(false);
        setCurrentTime(0);
      };
      utterance.onerror = () => {
        setIsPlaying(false);
      };
      utteranceRef.current = utterance;
      window.speechSynthesis.speak(utterance);
      setIsPlaying(true);
    }
  }, [plainText, playbackRate]);

  const setupAudioElement = useCallback(
    (audio: HTMLAudioElement) => {
      audio.playbackRate = playbackRate;

      audio.onloadedmetadata = () => {
        if (audio.duration && !Number.isNaN(audio.duration) && audio.duration > 0) {
          setDuration(audio.duration);
        }
      };

      audio.ontimeupdate = () => {
        setCurrentTime(audio.currentTime);
      };

      audio.onended = () => {
        setIsPlaying(false);
        setCurrentTime(0);
      };

      audio.onerror = () => {
        if (!isActiveRef.current) return;
        console.warn("Stored MP3 failed; falling back to Kokoro or Web Speech");
        void playLiveNarrationRef.current?.();
      };
    },
    [playbackRate],
  );

  const startKokoroPlayback = useCallback(async () => {
    if (!isActiveRef.current) return;

    setIsLoading(true);
    setStatusMessage("Preparing Kokoro (local) narration…");
    setActiveBackend("kokoro-local");

    const session = new KokoroPlaybackSession();
    kokoroSessionRef.current = session;

    session.setOnEnded(() => {
      stopKokoroTick();
      setIsPlaying(false);
      setCurrentTime(0);
    });

    void session
      .start(plainText, {
        onLoadProgress: (info) => {
          if (!isActiveRef.current) return;
          setStatusMessage(formatLoadProgress(info));
        },
        onDevice: (device) => {
          setKokoroDevice(device);
        },
        onFirstAudio: () => {
          if (!isActiveRef.current) return;
          setIsLoading(false);
          setStatusMessage(null);
          setIsPlaying(true);
          stopKokoroTick();
          kokoroTickRef.current = window.setInterval(() => {
            const active = kokoroSessionRef.current;
            if (!active) return;
            setCurrentTime(active.getCurrentTimeSec());
            const est = active.getEstimatedDurationSec();
            if (est > 0) {
              setDuration(est);
            }
          }, 250);
        },
      })
      .then(() => {
        stopKokoroTick();
        setIsPlaying(false);
        setCurrentTime(0);
      })
      .catch(async (error) => {
        if (!isActiveRef.current) return;
        console.warn("Kokoro unavailable, falling back to Web Speech:", error);
        await session.stop();
        kokoroSessionRef.current = null;
        const speechFallback = resolveFallbackAfterKokoroFailure(
          hasSpeechSynthesis(window),
        );
        if (speechFallback === "browser-speech-synthesis") {
          fallbackToBrowserSpeech();
        } else {
          setIsLoading(false);
          setStatusMessage("Audio narration is unavailable in this browser.");
        }
      });
  }, [plainText, fallbackToBrowserSpeech, stopKokoroTick]);

  const playLiveNarration = useCallback(async () => {
    if (!isActiveRef.current) return;

    const primary = resolvePrimaryListenBackend({
      storedGeminiMp3Url: null,
      kokoroAvailable: isKokoroRuntimeSupported(),
      speechSynthesisAvailable:
        typeof window !== "undefined" && hasSpeechSynthesis(window),
    });

    if (primary === "kokoro-local") {
      await startKokoroPlayback();
      return;
    }

    fallbackToBrowserSpeech();
  }, [fallbackToBrowserSpeech, startKokoroPlayback]);

  playLiveNarrationRef.current = playLiveNarration;

  const playStoredMp3 = useCallback(async () => {
    if (!staticAudioSrc || !isActiveRef.current) return;

    setActiveBackend("stored-gemini-mp3");
    if (!audioRef.current) {
      audioRef.current = new Audio(staticAudioSrc);
    } else {
      audioRef.current.onerror = null;
      audioRef.current.src = staticAudioSrc;
    }
    setupAudioElement(audioRef.current);
    audioRef.current.playbackRate = playbackRate;

    try {
      await audioRef.current.play();
      if (!isActiveRef.current) {
        stopAllPlayback();
        return;
      }
      setIsPlaying(true);
      setStatusMessage(null);
    } catch (err) {
      if (!isActiveRef.current) return;
      console.warn("Stored MP3 playback failed:", err);
      await playLiveNarration();
    }
  }, [staticAudioSrc, playbackRate, setupAudioElement, stopAllPlayback, playLiveNarration]);

  const handleTogglePlay = useCallback(async () => {
    isActiveRef.current = true;

    if (isPlaying) {
      if (activeBackend === "browser-speech-synthesis") {
        if (typeof window !== "undefined" && "speechSynthesis" in window) {
          window.speechSynthesis.pause();
        }
      } else if (activeBackend === "kokoro-local" && kokoroSessionRef.current) {
        await kokoroSessionRef.current.pause();
        stopKokoroTick();
      } else if (audioRef.current) {
        audioRef.current.pause();
      }
      setIsPlaying(false);
      return;
    }

    if (activeBackend === "browser-speech-synthesis") {
      if (typeof window !== "undefined" && "speechSynthesis" in window) {
        if (window.speechSynthesis.paused) {
          window.speechSynthesis.resume();
          setIsPlaying(true);
        } else {
          fallbackToBrowserSpeech();
        }
      }
      return;
    }

    if (activeBackend === "kokoro-local" && kokoroSessionRef.current) {
      await kokoroSessionRef.current.resume();
      kokoroTickRef.current = window.setInterval(() => {
        const session = kokoroSessionRef.current;
        if (!session) return;
        setCurrentTime(session.getCurrentTimeSec());
      }, 250);
      setIsPlaying(true);
      return;
    }

    if (
      audioRef.current &&
      audioRef.current.src &&
      activeBackend === "stored-gemini-mp3" &&
      audioRef.current.currentTime > 0 &&
      !audioRef.current.ended
    ) {
      audioRef.current.playbackRate = playbackRate;
      void audioRef.current.play();
      setIsPlaying(true);
      return;
    }

    if (staticAudioSrc) {
      await playStoredMp3();
      return;
    }

    await playLiveNarration();
  }, [
    isPlaying,
    activeBackend,
    playbackRate,
    fallbackToBrowserSpeech,
    playStoredMp3,
    playLiveNarration,
    staticAudioSrc,
    stopKokoroTick,
  ]);

  const handleSpeedToggle = () => {
    const nextRate: 1 | 1.25 | 1.5 =
      playbackRate === 1 ? 1.25 : playbackRate === 1.25 ? 1.5 : 1;
    setPlaybackRate(nextRate);

    if (audioRef.current) {
      audioRef.current.playbackRate = nextRate;
    }

    if (
      activeBackend === "browser-speech-synthesis" &&
      isPlaying &&
      typeof window !== "undefined"
    ) {
      window.speechSynthesis.cancel();
      fallbackToBrowserSpeech();
    }
  };

  const handleSeek = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!progressBarRef.current || duration <= 0) return;
    if (activeBackend !== "stored-gemini-mp3") return;
    const rect = progressBarRef.current.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const ratio = Math.max(0, Math.min(1, clickX / rect.width));
    const seekTime = ratio * duration;

    setCurrentTime(seekTime);
    if (audioRef.current) {
      audioRef.current.currentTime = seekTime;
    }
  };

  const progressBarRef = useRef<HTMLDivElement | null>(null);

  const formatSeconds = (sec: number) => {
    const safeSec = Math.max(0, Math.floor(sec));
    const mins = Math.floor(safeSec / 60);
    const remainder = safeSec % 60;
    return `${mins}:${remainder < 10 ? "0" : ""}${remainder}`;
  };

  const progressPercent = duration > 0 ? (currentTime / duration) * 100 : 0;

  const backendLabel = (() => {
    if (statusMessage) return null;
    if (activeBackend === "browser-speech-synthesis") {
      return `Browser Speech • ~${listenMinutes} min listen`;
    }
    if (activeBackend === "stored-gemini-mp3") {
      return `Narrated by ${narratorName} • ~${listenMinutes} min listen`;
    }
    if (activeBackend === "kokoro-local") {
      const deviceLabel = kokoroDevice === "webgpu" ? "WebGPU" : "WASM";
      return `Kokoro (${KOKORO_DEFAULT_VOICE}, ${deviceLabel}) • ~${listenMinutes} min listen`;
    }
    if (staticAudioSrc) {
      return `Narrated by ${narratorName} • ~${listenMinutes} min listen`;
    }
    return `Kokoro local voice • ~${listenMinutes} min listen`;
  })();

  return (
    <div className="my-6 rounded-2xl border border-zinc-200/90 bg-gradient-to-r from-zinc-50 via-zinc-100/60 to-zinc-50 p-4 shadow-2xs dark:border-zinc-800 dark:from-zinc-900/90 dark:via-zinc-900/50 dark:to-zinc-900/90">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => void handleTogglePlay()}
            disabled={isLoading}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-zinc-900 text-white shadow-sm transition hover:scale-105 hover:bg-zinc-800 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
            aria-label={
              isLoading
                ? "Loading audio narration"
                : isPlaying
                  ? "Pause audio narration"
                  : "Play audio narration"
            }
          >
            {isLoading ? (
              <span className="h-4 w-4 rounded-full border-2 border-current border-t-transparent animate-spin" />
            ) : isPlaying ? (
              <span className="text-sm">⏸</span>
            ) : (
              <span className="ml-0.5 text-sm">▶</span>
            )}
          </button>

          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold tracking-tight text-zinc-900 dark:text-zinc-100">
                Listen to Dispatch
              </span>
              {isPlaying ? (
                <div className="flex items-center gap-0.5" aria-hidden="true">
                  <span className="h-2.5 w-0.5 animate-pulse rounded-full bg-emerald-500" />
                  <span className="h-4 w-0.5 animate-pulse rounded-full bg-emerald-500 [animation-delay:150ms]" />
                  <span className="h-1.5 w-0.5 animate-pulse rounded-full bg-emerald-500 [animation-delay:300ms]" />
                  <span className="h-3 w-0.5 animate-pulse rounded-full bg-emerald-500 [animation-delay:450ms]" />
                </div>
              ) : null}
            </div>
            <p className="text-[11px] text-zinc-500">
              {statusMessage ? (
                <span className="font-medium text-amber-600 dark:text-amber-400">
                  {statusMessage}
                </span>
              ) : (
                backendLabel
              )}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className="font-mono text-xs text-zinc-500">
            {formatSeconds(currentTime)} / {formatSeconds(duration)}
          </span>

          <button
            type="button"
            onClick={handleSpeedToggle}
            className="rounded-full border border-zinc-200 bg-white px-2.5 py-1 text-xs font-semibold text-zinc-700 hover:bg-zinc-100 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-300 dark:hover:bg-zinc-800 transition"
            title="Toggle playback speed"
          >
            {playbackRate}x
          </button>
        </div>
      </div>

      <div
        ref={progressBarRef}
        onClick={handleSeek}
        role="progressbar"
        aria-valuenow={Math.round(progressPercent)}
        aria-valuemin={0}
        aria-valuemax={100}
        tabIndex={0}
        className="mt-3 h-2 w-full cursor-pointer overflow-hidden rounded-full bg-zinc-200 transition hover:h-2.5 dark:bg-zinc-800"
        title={
          activeBackend === "stored-gemini-mp3" ? "Click to seek" : "Progress"
        }
      >
        <div
          className="h-full bg-zinc-900 transition-all duration-150 dark:bg-zinc-100"
          style={{ width: `${Math.min(100, Math.max(0, progressPercent))}%` }}
        />
      </div>
    </div>
  );
}
