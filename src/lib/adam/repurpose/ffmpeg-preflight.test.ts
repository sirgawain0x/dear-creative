import { describe, expect, it } from "vitest";
import ffmpegStatic from "ffmpeg-static";
import { runRepurposeVideoRenderPreflight } from "./ffmpeg-preflight";

const ffmpegPath =
  typeof ffmpegStatic === "string" && ffmpegStatic.length > 0
    ? ffmpegStatic
    : null;

describe("runRepurposeVideoRenderPreflight", () => {
  it("passes on bundled ffmpeg-static with PNG slide render", async () => {
    if (!ffmpegPath) {
      return;
    }
    const result = await runRepurposeVideoRenderPreflight();
    expect(result.encodersChecked).toContain("libx264");
    expect(result.encodersChecked).toContain("aac");
    expect(result.filtersChecked).toContain("concat");
    expect(result.ffmpegVersionLine.toLowerCase()).toContain("ffmpeg");
    expect(result.slideRenderMs).toBeGreaterThan(0);
  });
});
