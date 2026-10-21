import { describe, expect, it, vi } from "vitest";
import { playAdamGoogleTts } from "./adam-message-tts";

describe("playAdamGoogleTts", () => {
  it("does not call browser fallback when the TTS fetch is aborted before completion", async () => {
    const fallback = vi.fn();
    let sessionActive = true;
    const abortRef: { current: AbortController | null } = { current: null };

    const pending = playAdamGoogleTts({
      text: "Hello",
      messageIndex: 0,
      isSessionActive: () => sessionActive,
      abortRef,
      fetchTts: (signal) =>
        new Promise((resolve, reject) => {
          signal.addEventListener(
            "abort",
            () => {
              reject(new DOMException("Aborted", "AbortError"));
            },
            { once: true },
          );
        }),
      speakBrowserFallback: fallback,
      onAudioCreated: vi.fn(),
    });

    expect(abortRef.current).not.toBeNull();
    sessionActive = false;
    abortRef.current?.abort();
    await pending;

    expect(fallback).not.toHaveBeenCalled();
  });
});
