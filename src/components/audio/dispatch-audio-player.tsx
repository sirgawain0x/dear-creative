"use client";

import { useCallback, useLayoutEffect, useRef, useState } from "react";
import { stripHtmlTags } from "@/lib/posts/reading-time";
import {
  LISTEN_SKIP_BACK_ARIA,
  LISTEN_SKIP_FORWARD_ARIA,
} from "./dispatch-audio-player-controls";
import { handleDispatchAudioDocumentClick } from "./dispatch-audio-player-navigation";
import { readerStoredNarrationLabel } from "./dispatch-audio-reader-label";
import {
  SEEK_SKIP_SECONDS,
  clampSeekTime,
  keyboardSeekTime,
  seekTimeFromClientX,
  shouldShowStoredAudioSeekControls,
  type SeekKeyboardKey,
} from "./dispatch-audio-player-seek";

export type GoogleVoice = "Puck" | "Aoede";

const BROWSER_SPEECH_VOICE: GoogleVoice = "Puck";

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
};

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
  const storedNarratorLabel = readerStoredNarrationLabel(audioVoice);

  const plainText = stripHtmlTags(
    `${title}. ${excerpt ? `${excerpt}. ` : ""}${bodyHtml ?? ""}`,
  )
    .replace(/\s+/g, " ")
    .trim();

  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [playbackRate, setPlaybackRate] = useState<1 | 1.25 | 1.5>(1);
  const [useBrowserSpeech, setUseBrowserSpeech] = useState(!staticAudioSrc);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);
  const isActiveRef = useRef(true);
  const progressBarRef = useRef<HTMLDivElement | null>(null);
  const isScrubbingRef = useRef(false);
  const playLiveNarrationRef = useRef<(() => void) | null>(null);

  const showSeekControls = shouldShowStoredAudioSeekControls({
    hasStaticAudioSrc: Boolean(staticAudioSrc),
    useBrowserSpeech,
  });

  const stopAllPlayback = useCallback(() => {
    stopDispatchAudioResources({
      audio: audioRef.current,
      utterance: utteranceRef.current,
      abortController: null,
    });
    setIsPlaying(false);
  }, []);

  useLayoutEffect(() => {
    isActiveRef.current = true;

    const handlePageLeave = () => {
      isActiveRef.current = false;
      stopAllPlayback();
    };

    const handleDocumentClick = (event: MouseEvent) => {
      handleDispatchAudioDocumentClick(
        event,
        window.location.href,
        handlePageLeave,
      );
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
  }, [stopAllPlayback, slug]);

  const fallbackToBrowserSpeech = useCallback(() => {
    if (!isActiveRef.current) return;
    setUseBrowserSpeech(true);
    setIsLoading(false);
    setStatusMessage(null);

    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(plainText);
      utterance.rate = playbackRate;
      const voices = window.speechSynthesis.getVoices();
      if (voices.length > 0) {
        const nameLower = BROWSER_SPEECH_VOICE.toLowerCase();
        const match = voices.find((v) => {
          const voiceName = v.name.toLowerCase();
          return (
            voiceName.includes(nameLower) ||
            (nameLower.includes("male") &&
              (voiceName.includes("male") ||
                voiceName.includes("daniel") ||
                voiceName.includes("david") ||
                voiceName.includes("alex") ||
                voiceName.includes("guy")) &&
              v.lang.startsWith("en"))
          );
        });
        if (match) {
          utterance.voice = match;
        }
      }

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
        console.warn("Audio playback error, switching to Web Speech fallback");
        void playLiveNarrationRef.current?.();
      };
    },
    [playbackRate],
  );

  const playLiveNarration = useCallback(() => {
    fallbackToBrowserSpeech();
  }, [fallbackToBrowserSpeech]);

  useLayoutEffect(() => {
    playLiveNarrationRef.current = playLiveNarration;
  }, [playLiveNarration]);

  const startPlayback = useCallback(
    async (startOffsetSec = 0) => {
      if (!isActiveRef.current) return;

      if (staticAudioSrc) {
        setUseBrowserSpeech(false);
        if (!audioRef.current) {
          audioRef.current = new Audio(staticAudioSrc);
        } else {
          audioRef.current.onerror = null;
          audioRef.current.src = staticAudioSrc;
        }
        setupAudioElement(audioRef.current);
        audioRef.current.playbackRate = playbackRate;
        audioRef.current.currentTime = startOffsetSec > 0 ? startOffsetSec : 0;
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
          console.warn("Cached audio playback failed:", err);
          fallbackToBrowserSpeech();
        }
        return;
      }

      fallbackToBrowserSpeech();
    },
    [
      playbackRate,
      fallbackToBrowserSpeech,
      setupAudioElement,
      staticAudioSrc,
      stopAllPlayback,
    ],
  );

  const handleTogglePlay = useCallback(async () => {
    isActiveRef.current = true;

    if (isPlaying) {
      if (useBrowserSpeech) {
        if (typeof window !== "undefined" && "speechSynthesis" in window) {
          window.speechSynthesis.pause();
        }
      } else if (audioRef.current) {
        audioRef.current.pause();
      }
      setIsPlaying(false);
      return;
    }

    if (useBrowserSpeech) {
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

    if (
      audioRef.current &&
      audioRef.current.src &&
      audioRef.current.currentTime > 0 &&
      !audioRef.current.ended
    ) {
      audioRef.current.playbackRate = playbackRate;
      void audioRef.current.play();
      setIsPlaying(true);
      return;
    }

    await startPlayback(0);
  }, [
    isPlaying,
    useBrowserSpeech,
    playbackRate,
    fallbackToBrowserSpeech,
    startPlayback,
  ]);

  const handleSpeedToggle = () => {
    const nextRate: 1 | 1.25 | 1.5 =
      playbackRate === 1 ? 1.25 : playbackRate === 1.25 ? 1.5 : 1;
    setPlaybackRate(nextRate);

    if (audioRef.current) {
      audioRef.current.playbackRate = nextRate;
    }

    if (useBrowserSpeech && isPlaying && typeof window !== "undefined") {
      window.speechSynthesis.cancel();
      fallbackToBrowserSpeech();
    }
  };

  const applySeekTime = useCallback(
    (seekTime: number) => {
      if (!showSeekControls || duration <= 0) return;
      const clamped = clampSeekTime(0, seekTime, duration);
      setCurrentTime(clamped);
      if (audioRef.current) {
        audioRef.current.currentTime = clamped;
      }
    },
    [duration, showSeekControls],
  );

  const seekFromClientX = useCallback(
    (clientX: number) => {
      if (!progressBarRef.current || duration <= 0) return;
      const rect = progressBarRef.current.getBoundingClientRect();
      applySeekTime(seekTimeFromClientX(clientX, rect, duration));
    },
    [applySeekTime, duration],
  );

  const handleProgressPointerDown = (
    e: React.PointerEvent<HTMLDivElement>,
  ) => {
    if (!showSeekControls || duration <= 0) return;
    e.preventDefault();
    isScrubbingRef.current = true;
    e.currentTarget.setPointerCapture(e.pointerId);
    seekFromClientX(e.clientX);
  };

  const handleProgressPointerMove = (
    e: React.PointerEvent<HTMLDivElement>,
  ) => {
    if (!isScrubbingRef.current || !showSeekControls) return;
    seekFromClientX(e.clientX);
  };

  const handleProgressPointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isScrubbingRef.current) return;
    isScrubbingRef.current = false;
    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId);
    }
  };

  const handleProgressKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (!showSeekControls || duration <= 0) return;
    const key = e.key;
    if (
      key !== "ArrowLeft" &&
      key !== "ArrowRight" &&
      key !== "Home" &&
      key !== "End"
    ) {
      return;
    }
    e.preventDefault();
    const next = keyboardSeekTime(
      currentTime,
      duration,
      key as SeekKeyboardKey,
    );
    if (next !== null) {
      applySeekTime(next);
    }
  };

  const handleSkipBackward = () => {
    if (!showSeekControls) return;
    applySeekTime(
      clampSeekTime(currentTime, -SEEK_SKIP_SECONDS, duration),
    );
  };

  const handleSkipForward = () => {
    if (!showSeekControls) return;
    applySeekTime(
      clampSeekTime(currentTime, SEEK_SKIP_SECONDS, duration),
    );
  };

  const formatSeconds = (sec: number) => {
    const safeSec = Math.max(0, Math.floor(sec));
    const mins = Math.floor(safeSec / 60);
    const remainder = safeSec % 60;
    return `${mins}:${remainder < 10 ? "0" : ""}${remainder}`;
  };

  const progressPercent = duration > 0 ? (currentTime / duration) * 100 : 0;

  return (
    <div className="my-6 rounded-2xl border border-zinc-200/90 bg-gradient-to-r from-zinc-50 via-zinc-100/60 to-zinc-50 p-4 shadow-2xs dark:border-zinc-800 dark:from-zinc-900/90 dark:via-zinc-900/50 dark:to-zinc-900/90">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5">
            {showSeekControls ? (
              <button
                type="button"
                onClick={handleSkipBackward}
                className="rounded-lg border border-zinc-200 bg-white px-2 py-1.5 text-xs font-medium text-zinc-700 shadow-xs hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800"
                aria-label={LISTEN_SKIP_BACK_ARIA}
              >
                −10s
              </button>
            ) : null}
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
                    : staticAudioSrc
                      ? "Play audio narration"
                      : "Play audio narration with browser speech"
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
            {showSeekControls ? (
              <button
                type="button"
                onClick={handleSkipForward}
                className="rounded-lg border border-zinc-200 bg-white px-2 py-1.5 text-xs font-medium text-zinc-700 shadow-xs hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800"
                aria-label={LISTEN_SKIP_FORWARD_ARIA}
              >
                +10s
              </button>
            ) : null}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
                Listen to Dispatch
              </p>
              {isPlaying ? (
                <div className="flex items-center gap-0.5" aria-hidden="true">
                  <span className="h-2.5 w-0.5 animate-pulse rounded-full bg-emerald-500" />
                  <span className="h-4 w-0.5 animate-pulse rounded-full bg-emerald-500 [animation-delay:150ms]" />
                  <span className="h-1.5 w-0.5 animate-pulse rounded-full bg-emerald-500 [animation-delay:300ms]" />
                  <span className="h-3 w-0.5 animate-pulse rounded-full bg-emerald-500 [animation-delay:450ms]" />
                </div>
              ) : null}
            </div>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              {staticAudioSrc
                ? `${storedNarratorLabel} • ~${listenMinutes} min listen`
                : `Browser speech (${BROWSER_SPEECH_VOICE}) • ~${listenMinutes} min listen`}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleSpeedToggle}
            className="rounded-lg border border-zinc-200 bg-white px-2 py-1 text-xs font-medium text-zinc-700 shadow-xs hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800"
          >
            {playbackRate}x
          </button>
        </div>
      </div>

      {(isLoading || statusMessage) && (
        <p className="mt-2 text-xs text-zinc-500">{statusMessage ?? "Loading…"}</p>
      )}

      {showSeekControls ? (
        <div className="mt-3 flex items-center gap-3">
          <span className="w-10 text-right text-xs tabular-nums text-zinc-500">
            {formatSeconds(currentTime)}
          </span>
          <div
            ref={progressBarRef}
            role="slider"
            aria-label="Playback position"
            aria-valuemin={0}
            aria-valuemax={Math.max(0, duration)}
            aria-valuenow={currentTime}
            tabIndex={0}
            onKeyDown={handleProgressKeyDown}
            onPointerDown={handleProgressPointerDown}
            onPointerMove={handleProgressPointerMove}
            onPointerUp={handleProgressPointerUp}
            onPointerCancel={handleProgressPointerUp}
            className="relative h-2 flex-1 touch-none cursor-pointer rounded-full bg-zinc-200 dark:bg-zinc-700"
          >
            <div
              className="absolute inset-y-0 left-0 rounded-full bg-zinc-900 dark:bg-zinc-100"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
          <span className="w-10 text-xs tabular-nums text-zinc-500">
            {formatSeconds(duration)}
          </span>
        </div>
      ) : null}
    </div>
  );
}
