import { describe, expect, it } from "vitest";
import { encodePcmToMp3 } from "./narration";
import {
  geminiTtsPayloadToMp3,
  isLikelyMp3Buffer,
  parseSampleRateFromAudioMime,
} from "./gemini-tts-audio";

function makePcm(byteLength = 4800): Buffer {
  const pcm = Buffer.alloc(byteLength);
  for (let i = 0; i < byteLength / 2; i++) {
    pcm.writeInt16LE(Math.round(Math.sin(i / 20) * 5000), i * 2);
  }
  return pcm;
}

function makeValidMp3Fixture(): Buffer {
  return encodePcmToMp3(makePcm(24000), 24000, 1);
}

describe("geminiTtsPayloadToMp3", () => {
  it("wraps raw PCM when mimeType claims mp3", () => {
    const pcm = makePcm(2400);
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

  it("passes through ID3-prefixed MP3 unchanged", () => {
    const mp3 = makeValidMp3Fixture();
    const id3Header = Buffer.from([0x49, 0x44, 0x33, 3, 0, 0, 0, 0, 0, 0]);
    const wrapped = Buffer.concat([id3Header, mp3]);
    expect(isLikelyMp3Buffer(wrapped)).toBe(true);
    const out = geminiTtsPayloadToMp3(wrapped, "audio/mp3");
    expect(out.equals(wrapped)).toBe(true);
  });

  it("passes through validated MP3 frame sync unchanged", () => {
    const mp3 = makeValidMp3Fixture();
    expect(isLikelyMp3Buffer(mp3)).toBe(true);
    const out = geminiTtsPayloadToMp3(mp3, "audio/mp3");
    expect(out.equals(mp3)).toBe(true);
  });

  it("converts PCM with false MP3 sync (0xFF 0xE0+), not pass-through", () => {
    const pcm = makePcm(4800);
    pcm[0] = 0xff;
    pcm[1] = 0xe0;
    expect(isLikelyMp3Buffer(pcm)).toBe(false);
    const out = geminiTtsPayloadToMp3(pcm, "audio/mp3");
    expect(out.equals(pcm)).toBe(false);
    expect(isLikelyMp3Buffer(out)).toBe(true);
  });

  it("rejects Ogg and FLAC containers", () => {
    const ogg = Buffer.concat([Buffer.from("OggS"), makePcm(100)]);
    const flac = Buffer.concat([Buffer.from("fLaC"), makePcm(100)]);
    expect(() => geminiTtsPayloadToMp3(ogg, "audio/ogg")).toThrow(
      "Unsupported TTS audio format",
    );
    expect(() => geminiTtsPayloadToMp3(flac, "audio/flac")).toThrow(
      "Unsupported TTS audio format",
    );
  });
});
