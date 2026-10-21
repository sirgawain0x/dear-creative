import { createHash } from "node:crypto";

export type WriterSplitPair = {
  wallet: string;
  shareBps: number;
};

/**
 * Canonical key for a writer split group: SHA-256 hex of sorted
 * `wallet:shareBps` pairs joined with `|`.
 */
export function computeWriterGroupKey(pairs: WriterSplitPair[]): string {
  if (pairs.length === 0) {
    throw new Error("pairs must not be empty");
  }
  const normalized = pairs.map((pair) => {
    const wallet = pair.wallet.trim().toLowerCase();
    if (!wallet) {
      throw new Error("wallet must not be empty");
    }
    if (!Number.isInteger(pair.shareBps) || pair.shareBps < 0) {
      throw new Error("shareBps must be a non-negative integer");
    }
    return { wallet, shareBps: pair.shareBps };
  });

  normalized.sort((a, b) => {
    if (a.wallet !== b.wallet) {
      return a.wallet.localeCompare(b.wallet);
    }
    return a.shareBps - b.shareBps;
  });

  const payload = normalized
    .map((pair) => `${pair.wallet}:${pair.shareBps}`)
    .join("|");
  return createHash("sha256").update(payload, "utf8").digest("hex");
}
