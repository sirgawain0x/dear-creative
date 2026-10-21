import { createHmac, timingSafeEqual } from "node:crypto";
import type { Address } from "viem";
import type { SwapDirection } from "./swap-constants";

export type SwapQuoteSealPayload = {
  from: Address;
  direction: SwapDirection;
  amount: string;
  slippageBps: number;
  expiry: string;
  fromAmount: string;
  minimumToAmount: string;
};

function quoteSealSecret(): string | null {
  const secret =
    process.env.WALLET_SWAP_QUOTE_HMAC_SECRET?.trim() ||
    process.env.ALCHEMY_API_KEY?.trim();
  return secret || null;
}

function canonicalSealBody(payload: SwapQuoteSealPayload): string {
  return JSON.stringify({
    amount: payload.amount,
    direction: payload.direction,
    expiry: payload.expiry,
    from: payload.from.toLowerCase(),
    fromAmount: payload.fromAmount.toLowerCase(),
    minimumToAmount: payload.minimumToAmount.toLowerCase(),
    slippageBps: payload.slippageBps,
  });
}

export function sealSwapQuote(payload: SwapQuoteSealPayload): string | null {
  const secret = quoteSealSecret();
  if (!secret) {
    return null;
  }
  return createHmac("sha256", secret)
    .update(canonicalSealBody(payload))
    .digest("base64url");
}

export function verifySwapQuoteSeal(
  seal: unknown,
  payload: SwapQuoteSealPayload,
): boolean {
  if (typeof seal !== "string" || !seal) {
    return false;
  }
  const expected = sealSwapQuote(payload);
  if (!expected) {
    return false;
  }
  try {
    const a = Buffer.from(seal);
    const b = Buffer.from(expected);
    return a.length === b.length && timingSafeEqual(a, b);
  } catch {
    return false;
  }
}
