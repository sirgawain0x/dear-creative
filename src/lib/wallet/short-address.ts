export function shortenAddress(address: string, visibleChars = 4): string {
  const normalized = address.trim();
  if (normalized.length <= visibleChars * 2 + 2) {
    return normalized;
  }
  return `${normalized.slice(0, visibleChars + 2)}…${normalized.slice(-visibleChars)}`;
}
