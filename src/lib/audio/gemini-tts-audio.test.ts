import { describe, expect, it } from "vitest";
import {
  geminiTtsPayloadToMp3,
  isLikelyMp3Buffer,
  parseSampleRateFromAudioMime,
} from "./gemini-tts-audio";

describe("geminiTtsPayloadToMp3", () => {
  it("wraps raw PCM when mimeType claims mp3", () => {
    const sampleCount = 2400;
    const pcm = Buffer.alloc(sampleCount * 2);
    for (let i = 0; i < sampleCount; i++) {
      pcm.writeInt16LE(Math.round(Math.sin(i / 20) * 8000), i * 2);
    }
    expect(isLikelyMp3Buffer(pcm)).toBe(false);

    const mp3 = geminiTtsPayloadToMp3(pcm, "audio/mp3");
    expect(mp3.length).toBeGreaterThan(100);
    expect(isLikelyMp3Buffer(mp3)).toBe(true);
  });

  it("handles audio/L16;rate=24000 payloads", () => {
    const pcm = Buffer.alloc(4800);
    const mp3 = geminiTtsPayloadToMp3(pcm, "audio/L16;rate=24000");
    expect(isLikelyMp3Buffer(mp3)).toBe(true);
  });

  it("parses sample rate from L16 mime", () => {
    expect(parseSampleRateFromAudioMime("audio/L16;rate=24000")).toBe(24000);
    expect(parseSampleRateFromAudioMime("audio/mp3")).toBeNull();
  });
});
