import { mkdtempSync } from "node:fs";
import { chmod, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  buildNarratedSlidesMp4,
  probeAudioDurationSeconds,
  resetRepurposeFfmpegEnvCacheForTests,
  resolveRepurposeFfmpegEnv,
  tailFfmpegStderrForLog,
} from "./ffmpeg";

describe("resolveRepurposeFfmpegEnv", () => {
  afterEach(() => {
    resetRepurposeFfmpegEnvCacheForTests();
  });

  it("writes fonts.conf under tmpdir when cwd is read-only", async () => {
    const roCwd = await mkdtemp(join(tmpdir(), "dear-ro-cwd-"));
    await chmod(roCwd, 0o555);
    const previous = process.cwd();
    process.chdir(roCwd);
    try {
      resetRepurposeFfmpegEnvCacheForTests();
      const env = await resolveRepurposeFfmpegEnv();
      expect(env.FONTCONFIG_FILE).toContain("dear-creative-fontconfig");
      expect(env.FONTCONFIG_FILE).toContain(tmpdir());
      expect(env.FONTCONFIG_FILE).not.toContain("repurpose-fontconfig.conf");
    } finally {
      process.chdir(previous);
      await chmod(roCwd, 0o755);
      await rm(roCwd, { recursive: true, force: true });
    }
  });
});

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
    expect(calls[0]?.join(" ")).toContain("expansion=none");
    expect(calls[0]?.join(" ")).toContain("textfile=");
    expect(calls[0]?.join(" ")).not.toContain("-shortest");
    expect(calls.at(-1)?.join(" ")).toContain("out.mp4");
    expect(calls.at(-1)?.join(" ")).not.toContain("-shortest");
  });
});
