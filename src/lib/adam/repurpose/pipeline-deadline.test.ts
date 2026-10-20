import { afterEach, describe, expect, it, vi } from "vitest";
import {
  fetchWithRepurposePipelineDeadline,
  REPURPOSE_PER_CALL_TIMEOUT_MESSAGE,
  REPURPOSE_VIDEO_WALL_TIMEOUT_MESSAGE,
} from "./pipeline-deadline";

describe("fetchWithRepurposePipelineDeadline errors", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("reports per-call timeout when wall budget remains", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.setSystemTime(0);
    let now = 0;
    const deadlineAtMs = 10_000;
    const fetchFn = vi.fn((_url: string, init?: RequestInit) => {
      return new Promise<Response>((_resolve, reject) => {
        init?.signal?.addEventListener("abort", () => {
          reject(new DOMException("Aborted", "AbortError"));
        });
      });
    });

    const promise = fetchWithRepurposePipelineDeadline(
      fetchFn as typeof fetch,
      "https://example.com",
      { method: "GET" },
      deadlineAtMs,
      50,
      now,
    );
    const rejection = expect(promise).rejects.toThrow(
      REPURPOSE_PER_CALL_TIMEOUT_MESSAGE,
    );
    now = 100;
    await vi.runAllTimersAsync();
    await rejection;
  });

  it("reports wall-clock deadline when the pipeline budget is exhausted", async () => {
    const deadlineAtMs = 100;
    await expect(
      fetchWithRepurposePipelineDeadline(
        fetch as typeof fetch,
        "https://example.com",
        { method: "GET" },
        deadlineAtMs,
        50,
        200,
      ),
    ).rejects.toThrow(REPURPOSE_VIDEO_WALL_TIMEOUT_MESSAGE);
  });
});
