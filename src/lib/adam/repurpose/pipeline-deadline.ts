import {
  ADAM_VIDEO_WALL_TIMEOUT_MESSAGE,
  buildAdamVideoFetchSignal,
  createAdamVideoDeadline,
} from "@/lib/adam/gemini-studio";

/** Wall-clock budget for repurpose video overview (below route maxDuration). */
export const REPURPOSE_VIDEO_PIPELINE_BUDGET_MS = 290_000;

export const REPURPOSE_VIDEO_WALL_TIMEOUT_MESSAGE = ADAM_VIDEO_WALL_TIMEOUT_MESSAGE;

export function createRepurposeVideoPipelineDeadline(
  nowMs: number = Date.now(),
): number {
  return createAdamVideoDeadline(REPURPOSE_VIDEO_PIPELINE_BUDGET_MS, nowMs);
}

export function remainingRepurposePipelineMs(
  deadlineAtMs: number,
  nowMs: number = Date.now(),
): number {
  return deadlineAtMs - nowMs;
}

export function assertRepurposePipelineBudget(
  deadlineAtMs: number,
  nowMs: number = Date.now(),
): void {
  if (remainingRepurposePipelineMs(deadlineAtMs, nowMs) <= 0) {
    throw new Error(REPURPOSE_VIDEO_WALL_TIMEOUT_MESSAGE);
  }
}

export function buildRepurposePipelineFetchSignal(
  deadlineAtMs: number,
  perFetchCapMs: number,
  nowMs: number = Date.now(),
): AbortSignal {
  return buildAdamVideoFetchSignal(deadlineAtMs, perFetchCapMs, nowMs);
}

function isAbortError(err: unknown): boolean {
  return err instanceof Error && err.name === "AbortError";
}

export async function fetchWithRepurposePipelineDeadline(
  fetchFn: typeof fetch,
  url: string,
  init: RequestInit | undefined,
  deadlineAtMs: number,
  perFetchCapMs: number,
  nowMs: number = Date.now(),
): Promise<Response> {
  assertRepurposePipelineBudget(deadlineAtMs, nowMs);
  const signal = buildRepurposePipelineFetchSignal(
    deadlineAtMs,
    perFetchCapMs,
    nowMs,
  );
  try {
    return await fetchFn(url, { ...init, signal });
  } catch (err) {
    if (isAbortError(err)) {
      throw new Error(REPURPOSE_VIDEO_WALL_TIMEOUT_MESSAGE);
    }
    throw err;
  }
}

export function wrapFetchForRepurposePipeline(
  fetchFn: typeof fetch,
  deadlineAtMs: number,
  perFetchCapMs: number,
  nowFn: () => number = Date.now,
): typeof fetch {
  return (url, init) =>
    fetchWithRepurposePipelineDeadline(
      fetchFn,
      url,
      init,
      deadlineAtMs,
      perFetchCapMs,
      nowFn(),
    );
}
