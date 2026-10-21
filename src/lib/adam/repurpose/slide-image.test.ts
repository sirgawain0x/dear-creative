import { mkdtemp, readFile, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  buildSlideTitleSvg,
  renderSlideTitlePng,
  resetRepurposeSlideFontCacheForTests,
} from "./slide-image";

const workDirs: string[] = [];

afterEach(async () => {
  resetRepurposeSlideFontCacheForTests();
  await Promise.all(
    workDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })),
  );
});

describe("renderSlideTitlePng", () => {
  it("writes a PNG with non-trivial size", async () => {
    const workDir = await mkdtemp(join(tmpdir(), "dear-slide-png-"));
    workDirs.push(workDir);
    const outputPath = join(workDir, "slide.png");
    await renderSlideTitlePng({ title: "Hello Video Overview", outputPath });
    const info = await stat(outputPath);
    expect(info.size).toBeGreaterThan(500);
    const bytes = await readFile(outputPath);
    expect(bytes.subarray(0, 8).toString("hex")).toMatch(/^89504e470d0a1a0a/);
  });

  it("escapes XML in slide titles", async () => {
    const svg = await buildSlideTitleSvg('Tom & Jerry <3 "quotes"');
    expect(svg).toContain("Tom &amp; Jerry");
    expect(svg).not.toContain("<3");
  });
});
