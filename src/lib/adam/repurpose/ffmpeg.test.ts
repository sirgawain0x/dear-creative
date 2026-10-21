import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import {
  buildNarratedSlidesMp4,
  probeAudioDurationSeconds,
  tailFfmpegStderrForLog,
} from "./ffmpeg";

describe("tailFfmpegStderrForLog", () => {
  it("keeps the last 2KB of stderr for error messages", () => {
    const headMarker = "HEAD_SHOULD_BE_TRUNCATED";
    const tailMarker = "ERROR_MARKER_AT_END";
    const stderr = `${headMarker}${"x".repeat(3000)}${tailMarker}`;
    const tailed = tailFfmpegStderrForLog(stderr);
    expect(tailed.length).toBeLessThanOrEqual(2048);
    expect(tailed).toContain(tailMarker);
    expect(tailed).not.toContain(headMarker);
  });
});

describe("probeAudioDurationSeconds", () => {
  it("throws when probe output has no duration", async () => {
    const ffmpeg = vi.fn(async () => {
      throw new Error("probe failed");
    });
    await expect(
      probeAudioDurationSeconds({
        audioPath: "/tmp/narration.mp3",
        ffmpeg,
      }),
    ).rejects.toThrow(/Could not probe audio duration/);
  });
});

describe("buildNarratedSlidesMp4", () => {
  it("renders PNG slides and encodes with loop stillimage + shortest per segment", async () => {
    const workDir = mkdtempSync(join(tmpdir(), "ffmpeg-test-"));
    const calls: string[][] = [];
    const ffmpeg = vi.fn(async (args: string[]) => {
      calls.push(args);
    });
    const renderSlidePng = vi.fn(async () => undefined);

    await buildNarratedSlidesMp4({
      workDir,
      slides: [
        {
          title: "Intro",
          audioPath: join(workDir, "n0.mp3"),
          durationSeconds: 4,
        },
        {
          title: "Outro",
          audioPath: join(workDir, "n1.mp3"),
          durationSeconds: 3,
        },
      ],
      outputPath: join(workDir, "out.mp4"),
      ffmpeg,
      renderSlidePng,
    });

    expect(renderSlidePng).toHaveBeenCalledTimes(2);
    expect(ffmpeg).toHaveBeenCalledTimes(3);
    expect(calls[0]?.join(" ")).toContain("-loop 1");
    expect(calls[0]?.join(" ")).toContain("slide-0.png");
    expect(calls[0]?.join(" ")).toContain("-shortest");
    expect(calls[0]?.join(" ")).toContain("-tune stillimage");
    expect(calls[0]?.join(" ")).not.toContain("drawtext");
    expect(calls.at(-1)?.join(" ")).toContain("out.mp4");
  });
});
