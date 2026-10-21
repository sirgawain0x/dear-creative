export function isQuoteNearOrPastExpiry(expiryIso: string, nowMs = Date.now()): boolean {
  const expiryMs = Date.parse(expiryIso);
  if (!Number.isFinite(expiryMs)) {
    return true;
  }
  return expiryMs <= nowMs;
}
