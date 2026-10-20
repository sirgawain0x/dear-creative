import type { RepurposeOutputType } from "./types";

const inFlight = new Set<string>();

function lockKey(postId: string, outputType: RepurposeOutputType): string {
  return `${postId}:${outputType}`;
}

export function tryAcquireRepurposeLock(
  postId: string,
  outputType: RepurposeOutputType,
): boolean {
  const key = lockKey(postId, outputType);
  if (inFlight.has(key)) {
    return false;
  }
  inFlight.add(key);
  return true;
}

export function releaseRepurposeLock(
  postId: string,
  outputType: RepurposeOutputType,
): void {
  inFlight.delete(lockKey(postId, outputType));
}

export function clearRepurposeLocksForTests(): void {
  inFlight.clear();
}
