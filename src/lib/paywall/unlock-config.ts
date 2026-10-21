import { USDC_DECIMALS } from "@/lib/payments/subscription-config";

/**
 * Per-post unlock price from POST_UNLOCK_PRICE_USDC (USDC main units, e.g. "1.5").
 * No hardcoded prod default — unset means unlock UI is hidden/disabled.
 */
export function postUnlockPriceUsdcUnits(): number | null {
  const raw = process.env.POST_UNLOCK_PRICE_USDC?.trim();
  if (!raw) {
    return null;
  }
  const parsed = Number.parseFloat(raw);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return null;
  }
  return parsed;
}

export function postUnlockAmountRaw(): bigint | null {
  const units = postUnlockPriceUsdcUnits();
  if (units === null) {
    return null;
  }
  const scaled = Math.round(units * 10 ** USDC_DECIMALS);
  if (!Number.isFinite(scaled) || scaled <= 0) {
    return null;
  }
  return BigInt(scaled);
}

