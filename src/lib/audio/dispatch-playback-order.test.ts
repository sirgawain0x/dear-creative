import { describe, expect, it } from "vitest";
import { resolvePrimaryListenBackend } from "./dispatch-playback-order";

describe("dispatch listen playback order", () => {
  it("prefers stored MP3 when the post has audioUrl", () => {
    expect(
      resolvePrimaryListenBackend({
        storedMp3Url: "https://cdn.example/narration.mp3",
        speechSynthesisAvailable: true,
      }),
    ).toBe("stored-mp3");
  });

  it("uses speechSynthesis when there is no stored MP3", () => {
    expect(
      resolvePrimaryListenBackend({
        storedMp3Url: null,
        speechSynthesisAvailable: true,
      }),
    ).toBe("browser-speech-synthesis");
  });

  it("ignores whitespace-only stored MP3 URLs", () => {
    expect(
      resolvePrimaryListenBackend({
        storedMp3Url: "   ",
        speechSynthesisAvailable: false,
      }),
    ).toBe("browser-speech-synthesis");
  });
});
