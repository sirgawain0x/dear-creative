import { copyFile, mkdtemp, readFile, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import ffmpegStatic from "ffmpeg-static";
import { afterEach, describe, expect, it } from "vitest";
import {
  buildSlideAssContent,
  buildSlideAssVideoFilter,
  renderSlideTitleFramePng,
} from "./slide-ffmpeg";

const ffmpegPath =
  typeof ffmpegStatic === "string" && ffmpegStatic.length > 0
    ? ffmpegStatic
    : null;

const workDirs: string[] = [];

afterEach(async () => {
  await Promise.all(
    workDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })),
  );
});

describe("buildSlideAssVideoFilter", () => {
  it("points ass subtitles at the bundled fonts directory", () => {
    const filter = buildSlideAssVideoFilter({
      assPath: "/tmp/slide.ass",
      fontsDir: "/app/src/assets/fonts",
    });
    expect(filter).toContain("ass=/tmp/slide.ass");
    expect(filter).toContain("fontsdir=/app/src/assets/fonts");
  });

  it("embeds wrapped title lines in ASS dialogue", () => {
    const ass = buildSlideAssContent("Hello World");
    expect(ass).toContain("DejaVu Sans");
    expect(ass).toContain("Hello World");
  });
});

describe("renderSlideTitleFramePng", () => {
  it("writes a PNG frame with bundled font via ass filter (local ffmpeg)", async () => {
    if (!ffmpegPath) {
      return;
    }

    const workDir = await mkdtemp(join(tmpdir(), "dear-ass-frame-"));
    workDirs.push(workDir);
    const outputPath = join(workDir, "frame.png");
    await renderSlideTitleFramePng({
      title: "Legible Video Title — AaBb 123",
      outputPath,
    });
    const info = await stat(outputPath);
    expect(info.size).toBeGreaterThan(800);
    const bytes = await readFile(outputPath);
    expect(bytes.subarray(0, 8).toString("hex")).toMatch(/^89504e470d0a1a0a/);

    const fixturePath = join(
      process.cwd(),
      "src/lib/adam/repurpose/fixtures/video-drawtext-frame.png",
    );
    await copyFile(outputPath, fixturePath);
  });
});
