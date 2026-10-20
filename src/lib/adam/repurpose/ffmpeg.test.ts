import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import { buildNarratedSlidesMp4 } from "./ffmpeg";

describe("buildNarratedSlidesMp4", () => {
  it("invokes ffmpeg for slides, concat, and mux", async () => {
    const workDir = mkdtempSync(join(tmpdir(), "ffmpeg-test-"));
    const calls: string[][] = [];
    const ffmpeg = vi.fn(async (args: string[]) => {
      calls.push(args);
    });

    await buildNarratedSlidesMp4({
      workDir,
      slideTitles: ["Intro", "Outro"],
      secondsPerSlide: 4,
      audioPath: join(workDir, "narration.mp3"),
      outputPath: join(workDir, "out.mp4"),
      ffmpeg,
    });

    expect(ffmpeg).toHaveBeenCalledTimes(4);
    expect(calls[0]?.join(" ")).toContain("drawtext");
    expect(calls.at(-1)?.join(" ")).toContain("out.mp4");
  });
});
