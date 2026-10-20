import { afterEach, describe, expect, it, vi } from "vitest";
import { REPURPOSE_VIDEO_WALL_TIMEOUT_MESSAGE } from "../pipeline-deadline";
import { generateVideoOverview } from "./video-overview";

describe("generateVideoOverview pipeline deadline", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.useRealTimers();
  });

  it("gives up when a fetch step hangs past the wall-clock budget", async () => {
    vi.stubEnv("GEMINI_API_KEY", "test-key");
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.setSystemTime(0);
    let now = 0;
    const nowFn = () => now;

    const fetchFn = vi.fn((_url: string, init?: RequestInit) => {
      return new Promise<Response>((_resolve, reject) => {
        init?.signal?.addEventListener("abort", () => {
          reject(new DOMException("Aborted", "AbortError"));
        });
      });
    });

    const promise = generateVideoOverview({
      source: {
        id: "p1",
        slug: "vid",
        title: "Vid",
        status: "published",
        authorId: "author-1",
        teaserText: null,
        plainText: "Article",
      },
      fetchFn: fetchFn as typeof fetch,
      pipeline: {
        deadlineAtMs: 100,
        nowFn,
        perFetchCapMs: 50,
      },
      ffmpeg: vi.fn(async () => undefined),
      synthesizeFn: vi.fn(),
      uploadFn: vi.fn(),
    });

    const rejection = expect(promise).rejects.toThrow(
      REPURPOSE_VIDEO_WALL_TIMEOUT_MESSAGE,
    );
    now = 200;
    await vi.runAllTimersAsync();
    await rejection;
  });
});
