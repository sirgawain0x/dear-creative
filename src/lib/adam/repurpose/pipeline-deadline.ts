import type { LensGroveUploadResult } from "@/lib/storage/lens-grove";
import {
  ADAM_VIDEO_WALL_TIMEOUT_MESSAGE,
  buildAdamVideoFetchSignal,
  createAdamVideoDeadline,
} from "@/lib/adam/gemini-studio";

/** Wall-clock budget for repurpose video overview (below route maxDuration). */
export const REPURPOSE_VIDEO_PIPELINE_BUDGET_MS = 290_000;

/** Per-call caps for deck JSON and slide TTS fetch steps. */
export const REPURPOSE_VIDEO_DECK_PER_FETCH_CAP_MS = 120_000;
export const REPURPOSE_VIDEO_TTS_PER_FETCH_CAP_MS = 120_000;
export const REPURPOSE_VIDEO_UPLOAD_PER_CALL_CAP_MS = 60_000;

export const REPURPOSE_VIDEO_WALL_TIMEOUT_MESSAGE = ADAM_VIDEO_WALL_TIMEOUT_MESSAGE;

export const REPURPOSE_PER_CALL_TIMEOUT_MESSAGE =
  "Repurpose video step exceeded the per-call timeout";

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

function rethrowRepurposePipelineFetchError(
  err: unknown,
  deadlineAtMs: number,
  nowMs: number,
): never {
  if (isAbortError(err)) {
    if (remainingRepurposePipelineMs(deadlineAtMs, nowMs) > 0) {
      throw new Error(REPURPOSE_PER_CALL_TIMEOUT_MESSAGE);
    }
    throw new Error(REPURPOSE_VIDEO_WALL_TIMEOUT_MESSAGE);
  }
  throw err;
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
    rethrowRepurposePipelineFetchError(err, deadlineAtMs, nowMs);
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
      typeof url === "string" ? url : url.toString(),
      init,
      deadlineAtMs,
      perFetchCapMs,
      nowFn(),
    );
}

export async function uploadWithRepurposePipelineDeadline(
  uploadFn: (
    file: File | Blob,
    fileName?: string,
    signal?: AbortSignal,
  ) => Promise<LensGroveUploadResult>,
  file: Blob,
  fileName: string,
  deadlineAtMs: number,
  perCallCapMs: number,
  nowMs: number = Date.now(),
  nowFn: () => number = Date.now,
): Promise<LensGroveUploadResult> {
  assertRepurposePipelineBudget(deadlineAtMs, nowMs);
  const signal = buildRepurposePipelineFetchSignal(
    deadlineAtMs,
    perCallCapMs,
    nowMs,
  );
  const uploadPromise = uploadFn(file, fileName, signal);
  const abortPromise = new Promise<never>((_, reject) => {
    const fail = () => {
      if (remainingRepurposePipelineMs(deadlineAtMs, nowFn()) > 0) {
        reject(new Error(REPURPOSE_PER_CALL_TIMEOUT_MESSAGE));
        return;
      }
      reject(new Error(REPURPOSE_VIDEO_WALL_TIMEOUT_MESSAGE));
    };
    if (signal.aborted) {
      fail();
      return;
    }
    signal.addEventListener("abort", fail, { once: true });
  });
  try {
    return await Promise.race([uploadPromise, abortPromise]);
  } catch (err) {
    rethrowRepurposePipelineFetchError(err, deadlineAtMs, nowFn());
  }
}
