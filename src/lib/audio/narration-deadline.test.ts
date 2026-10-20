import { afterEach, describe, expect, it, vi } from "vitest";
import {
  buildNarrationFetchSignal,
  createNarrationDeadline,
  NARRATION_ROUTE_BUDGET_MS,
  NARRATION_WALL_TIMEOUT_MESSAGE,
  remainingNarrationBudgetMs,
} from "./narration-deadline";
import { NEXT_ROUTE_MAX_DURATION_SEC } from "./narration-provider";

describe("narration wall-clock budget", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("uses a single route budget below maxDuration", () => {
    expect(NARRATION_ROUTE_BUDGET_MS).toBeLessThan(
      NEXT_ROUTE_MAX_DURATION_SEC * 1000,
    );
  });

  it("does not let per-chunk timeouts exceed remaining route budget", async () => {
    vi.useFakeTimers();
    const deadlineAtMs = createNarrationDeadline(100, 0);
    const signal = buildNarrationFetchSignal(deadlineAtMs, 80, 0);

    const pending = new Promise<void>((_resolve, reject) => {
      signal.addEventListener("abort", () => reject(new Error("aborted")));
    });

    await vi.advanceTimersByTimeAsync(100);
    await expect(pending).rejects.toThrow("aborted");
    expect(remainingNarrationBudgetMs(deadlineAtMs, 100)).toBeLessThanOrEqual(0);
  });

  it("maps abort errors to the narration wall timeout message", () => {
    expect(NARRATION_WALL_TIMEOUT_MESSAGE).toContain("290s");
  });
});
