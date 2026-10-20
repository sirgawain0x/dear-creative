/** Wall-clock budget for publish/audio routes (ms), below Vercel 300s limit. */
export const NARRATION_ROUTE_BUDGET_MS = 290_000;

export const NARRATION_WALL_TIMEOUT_MESSAGE =
  "Post narration generation exceeded the 290s wall-clock budget";

export const NARRATION_DEFAULT_PER_FETCH_CAP_MS = 120_000;

/** Minimum remaining budget before starting another chunk or Gemini fallback. */
export const MIN_NARRATION_CHUNK_BUDGET_MS = 5_000;

export function hasNarrationBudgetForChunk(
  deadlineAtMs: number,
  nowMs: number = Date.now(),
): boolean {
  return remainingNarrationBudgetMs(deadlineAtMs, nowMs) >= MIN_NARRATION_CHUNK_BUDGET_MS;
}

export function createNarrationDeadline(
  budgetMs: number = NARRATION_ROUTE_BUDGET_MS,
  nowMs: number = Date.now(),
): number {
  return nowMs + budgetMs;
}

export function remainingNarrationBudgetMs(
  deadlineAtMs: number,
  nowMs: number = Date.now(),
): number {
  return deadlineAtMs - nowMs;
}

export function throwIfNarrationDeadlineExceeded(
  deadlineAtMs: number,
  nowMs: number = Date.now(),
): void {
  if (remainingNarrationBudgetMs(deadlineAtMs, nowMs) <= 0) {
    throw new Error(NARRATION_WALL_TIMEOUT_MESSAGE);
  }
}

/**
 * One wall-clock budget shared across all chunk fetches (see Adam video pattern).
 * Per-chunk cap cannot exceed remaining route budget.
 */
export function buildNarrationFetchSignal(
  deadlineAtMs: number,
  perFetchCapMs: number = NARRATION_DEFAULT_PER_FETCH_CAP_MS,
  nowMs: number = Date.now(),
): AbortSignal {
  const remaining = remainingNarrationBudgetMs(deadlineAtMs, nowMs);
  if (remaining <= 0) {
    return AbortSignal.timeout(0);
  }
  const perFetchMs = Math.min(perFetchCapMs, remaining);
  if (perFetchMs >= remaining) {
    return AbortSignal.timeout(perFetchMs);
  }
  return AbortSignal.any([
    AbortSignal.timeout(perFetchMs),
    AbortSignal.timeout(remaining),
  ]);
}

export function isNarrationAbortError(err: unknown): boolean {
  return err instanceof Error && err.name === "AbortError";
}

export function rethrowNarrationFetchError(err: unknown): never {
  if (isNarrationAbortError(err)) {
    throw new Error(NARRATION_WALL_TIMEOUT_MESSAGE);
  }
  throw err;
}
