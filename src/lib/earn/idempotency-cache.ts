type CachedEntry = {
  expiresAtMs: number;
  body: unknown;
  status: number;
};

const cache = new Map<string, CachedEntry>();
const DEFAULT_TTL_MS = 5 * 60 * 1000;

export function earnActionsIdempotencyKey(
  userId: string,
  idempotencyKey: string,
): string {
  return `${userId}:${idempotencyKey}`;
}

export function getIdempotentEarnActionResponse(
  key: string,
): CachedEntry | null {
  const entry = cache.get(key);
  if (!entry) {
    return null;
  }
  if (Date.now() > entry.expiresAtMs) {
    cache.delete(key);
    return null;
  }
  return entry;
}

export function storeIdempotentEarnActionResponse(
  key: string,
  body: unknown,
  status: number,
  ttlMs: number = DEFAULT_TTL_MS,
): void {
  cache.set(key, {
    body,
    status,
    expiresAtMs: Date.now() + ttlMs,
  });
}

export function clearEarnActionsIdempotencyCacheForTests(): void {
  cache.clear();
}
