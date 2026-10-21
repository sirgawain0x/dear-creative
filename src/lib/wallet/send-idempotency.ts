type SendIdempotencyEntry =
  | { status: "pending" }
  | { status: "complete"; txHash: string };

const sendIdempotencyStore = new Map<string, SendIdempotencyEntry>();

export function resetSendIdempotencyStoreForTests(): void {
  sendIdempotencyStore.clear();
}

export type SendIdempotencyCheck =
  | { action: "proceed" }
  | { action: "return"; txHash: string }
  | { action: "conflict" };

export function checkSendIdempotencyKey(key: string): SendIdempotencyCheck {
  const entry = sendIdempotencyStore.get(key);
  if (!entry) {
    return { action: "proceed" };
  }
  if (entry.status === "complete") {
    return { action: "return", txHash: entry.txHash };
  }
  return { action: "conflict" };
}

export function markSendIdempotencyPending(key: string): void {
  sendIdempotencyStore.set(key, { status: "pending" });
}

export function markSendIdempotencyComplete(key: string, txHash: string): void {
  sendIdempotencyStore.set(key, { status: "complete", txHash });
}

export function clearSendIdempotencyPending(key: string): void {
  const entry = sendIdempotencyStore.get(key);
  if (entry?.status === "pending") {
    sendIdempotencyStore.delete(key);
  }
}
