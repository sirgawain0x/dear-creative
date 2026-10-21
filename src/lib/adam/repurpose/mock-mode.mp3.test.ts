import { describe, expect, it } from "vitest";
import ffmpegStatic from "ffmpeg-static";
import { generateMockSilentNarrationMp3 } from "./mock-mode";
import { probeAudioDurationSeconds, defaultFfmpegRunner } from "./ffmpeg";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";

const ffmpegPath =
  typeof ffmpegStatic === "string" && ffmpegStatic.length > 0
    ? ffmpegStatic
    : null;

describe("generateMockSilentNarrationMp3", () => {
  it("returns a probe-able MP3 of a few seconds", async () => {
    if (!ffmpegPath) {
      return;
    }
    const mp3 = await generateMockSilentNarrationMp3();
    expect(mp3.length).toBeGreaterThan(100);
    expect(mp3[0]).toBe(0xff);
    expect((mp3[1]! & 0xe0) === 0xe0).toBe(true);

    const workDir = await mkdtemp(join(tmpdir(), "mock-mp3-"));
    try {
      const audioPath = join(workDir, "silent.mp3");
      await writeFile(audioPath, mp3);
      const duration = await probeAudioDurationSeconds({
        audioPath,
        ffmpeg: defaultFfmpegRunner,
      });
      expect(duration).toBeGreaterThanOrEqual(2.5);
      expect(duration).toBeLessThanOrEqual(3.5);
    } finally {
      await rm(workDir, { recursive: true, force: true });
    }
  });
});
