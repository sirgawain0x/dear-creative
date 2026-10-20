import { describe, expect, it } from "vitest";
import {
  resolveFallbackAfterKokoroFailure,
  resolvePrimaryListenBackend,
} from "./dispatch-playback-order";

describe("dispatch listen fallback ordering", () => {
  it("prefers stored Gemini MP3 when the post has audioUrl", () => {
    expect(
      resolvePrimaryListenBackend({
        storedGeminiMp3Url: "https://cdn.example/narration.mp3",
        kokoroAvailable: true,
        speechSynthesisAvailable: true,
      }),
    ).toBe("stored-gemini-mp3");
  });

  it("uses Kokoro when there is no stored MP3 and the runtime supports it", () => {
    expect(
      resolvePrimaryListenBackend({
        storedGeminiMp3Url: null,
        kokoroAvailable: true,
        speechSynthesisAvailable: true,
      }),
    ).toBe("kokoro-local");
  });

  it("falls back to speechSynthesis when Kokoro is unavailable", () => {
    expect(
      resolvePrimaryListenBackend({
        storedGeminiMp3Url: "",
        kokoroAvailable: false,
        speechSynthesisAvailable: true,
      }),
    ).toBe("browser-speech-synthesis");
  });

  it("falls back to speechSynthesis after Kokoro load or synthesis failure", () => {
    expect(resolveFallbackAfterKokoroFailure(true)).toBe(
      "browser-speech-synthesis",
    );
    expect(resolveFallbackAfterKokoroFailure(false)).toBeNull();
  });

  it("ignores whitespace-only stored MP3 URLs", () => {
    expect(
      resolvePrimaryListenBackend({
        storedGeminiMp3Url: "   ",
        kokoroAvailable: true,
        speechSynthesisAvailable: false,
      }),
    ).toBe("kokoro-local");
  });
});
