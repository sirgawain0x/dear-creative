const DEFAULT_TTL_MS = 15 * 60 * 1000;

type ReplayEntry = { expiresAtMs: number };

let replayStore: Map<string, ReplayEntry> | null = null;

function store(): Map<string, ReplayEntry> {
  if (!replayStore) {
    replayStore = new Map();
  }
  return replayStore;
}

export function resetSwapQuoteSealReplayStoreForTests(): void {
  replayStore = null;
}

function pruneExpired(nowMs: number): void {
  const s = store();
  for (const [key, entry] of s) {
    if (entry.expiresAtMs <= nowMs) {
      s.delete(key);
    }
  }
}

/** Returns false if this seal was already consumed within the TTL window. */
export function consumeSwapQuoteSealOnce(
  seal: string,
  ttlMs: number = DEFAULT_TTL_MS,
): boolean {
  const nowMs = Date.now();
  pruneExpired(nowMs);
  const s = store();
  if (s.has(seal)) {
    return false;
  }
  s.set(seal, { expiresAtMs: nowMs + ttlMs });
  return true;
}
