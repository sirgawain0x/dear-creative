import { USDC_DECIMALS } from "@/lib/payments/subscription-config";

/** G2 default per-post unlock when POST_UNLOCK_PRICE_USDC is unset or invalid. */
export const DEFAULT_POST_UNLOCK_PRICE_USDC = 1;

/** Positive decimal string with at most six fractional digits (USDC display units). */
const POST_UNLOCK_PRICE_PATTERN =
  /^(?:[1-9]\d*(?:\.\d{1,6})?|0\.\d{1,6})$/;

function parseValidatedPostUnlockPrice(raw: string | undefined): number {
  const trimmed = raw?.trim();
  if (!trimmed) {
    return DEFAULT_POST_UNLOCK_PRICE_USDC;
  }
  if (!POST_UNLOCK_PRICE_PATTERN.test(trimmed)) {
    return DEFAULT_POST_UNLOCK_PRICE_USDC;
  }
  const parsed = Number.parseFloat(trimmed);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return DEFAULT_POST_UNLOCK_PRICE_USDC;
  }
  return parsed;
}

/**
 * Per-post unlock price from POST_UNLOCK_PRICE_USDC (USDC main units, e.g. "1.5").
 * Defaults to $1 when unset; invalid values fall back to $1.
 */
export function postUnlockPriceUsdcUnits(): number {
  return parseValidatedPostUnlockPrice(process.env.POST_UNLOCK_PRICE_USDC);
}

export function postUnlockAmountRaw(): bigint {
  const units = postUnlockPriceUsdcUnits();
  const scaled = Math.round(units * 10 ** USDC_DECIMALS);
  if (!Number.isFinite(scaled) || scaled <= 0) {
    return BigInt(DEFAULT_POST_UNLOCK_PRICE_USDC * 10 ** USDC_DECIMALS);
  }
  return BigInt(scaled);
}
