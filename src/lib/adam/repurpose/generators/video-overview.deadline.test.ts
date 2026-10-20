import { afterEach, describe, expect, it, vi } from "vitest";
import { REPURPOSE_VIDEO_WALL_TIMEOUT_MESSAGE } from "../pipeline-deadline";
import { generateVideoOverview } from "./video-overview";

describe("generateVideoOverview pipeline deadline", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("fails immediately when the wall-clock budget is already exhausted", async () => {
    vi.stubEnv("GEMINI_API_KEY", "test-key");
    const deadlineAtMs = 100;
    const nowFn = () => 200;

    await expect(
      generateVideoOverview({
        source: {
          id: "p1",
          slug: "vid",
          title: "Vid",
          status: "published",
          authorId: "author-1",
          teaserText: null,
          plainText: "Article",
        },
        pipeline: {
          deadlineAtMs,
          nowFn,
        },
        ffmpeg: vi.fn(async () => undefined),
        synthesizeFn: vi.fn(),
        uploadFn: vi.fn(),
      }),
    ).rejects.toThrow(REPURPOSE_VIDEO_WALL_TIMEOUT_MESSAGE);
  });
});
