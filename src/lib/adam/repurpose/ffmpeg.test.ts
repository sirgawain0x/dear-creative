import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import { buildNarratedSlidesMp4 } from "./ffmpeg";

describe("buildNarratedSlidesMp4", () => {
  it("invokes ffmpeg per slide and concat without final -shortest", async () => {
    const workDir = mkdtempSync(join(tmpdir(), "ffmpeg-test-"));
    const calls: string[][] = [];
    const ffmpeg = vi.fn(async (args: string[]) => {
      calls.push(args);
    });

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
    });

    expect(ffmpeg).toHaveBeenCalledTimes(3);
    expect(calls[0]?.join(" ")).toContain("drawtext");
    expect(calls[0]?.join(" ")).toContain("textfile=");
    expect(calls[0]?.join(" ")).not.toContain("-shortest");
    expect(calls.at(-1)?.join(" ")).toContain("out.mp4");
    expect(calls.at(-1)?.join(" ")).not.toContain("-shortest");
  });
});
