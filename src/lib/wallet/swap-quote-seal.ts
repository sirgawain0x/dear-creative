import { createHmac, timingSafeEqual } from "node:crypto";
import type { Address } from "viem";
import { BASE_CHAIN_ID, type SwapDirection } from "./swap-constants";

/** Dedicated env var for swap quote HMAC seals (never reuse other secrets). */
export const WALLET_SWAP_QUOTE_SEAL_SECRET_ENV = "WALLET_SWAP_QUOTE_SEAL_SECRET";

const MIN_SEAL_SECRET_BYTES = 32;

export type SwapQuoteSealPayload = {
  from: Address;
  direction: SwapDirection;
  amount: string;
  slippageBps: number;
  expiry: string;
  fromAmount: string;
  minimumToAmount: string;
  chainId: number;
  preparedDigest: string;
  signatureRequestDigest: string;
};

export type SwapQuoteSealSecretStatus =
  | { ok: true; secret: string }
  | { ok: false; reason: "unset" | "too_short" };

export function resolveSwapQuoteSealSecret(): SwapQuoteSealSecretStatus {
  const raw = process.env[WALLET_SWAP_QUOTE_SEAL_SECRET_ENV]?.trim();
  if (!raw) {
    return { ok: false, reason: "unset" };
  }
  if (Buffer.byteLength(raw, "utf8") < MIN_SEAL_SECRET_BYTES) {
    return { ok: false, reason: "too_short" };
  }
  return { ok: true, secret: raw };
}

export function isSwapQuoteSealConfigured(): boolean {
  return resolveSwapQuoteSealSecret().ok;
}

function canonicalSealBody(payload: SwapQuoteSealPayload): string {
  return JSON.stringify({
    amount: payload.amount,
    chainId: payload.chainId,
    direction: payload.direction,
    expiry: payload.expiry,
    from: payload.from.toLowerCase(),
    fromAmount: payload.fromAmount.toLowerCase(),
    minimumToAmount: payload.minimumToAmount.toLowerCase(),
    preparedDigest: payload.preparedDigest,
    signatureRequestDigest: payload.signatureRequestDigest,
    slippageBps: payload.slippageBps,
  });
}

export function sealSwapQuote(payload: SwapQuoteSealPayload): string | null {
  const resolved = resolveSwapQuoteSealSecret();
  if (!resolved.ok) {
    return null;
  }
  return createHmac("sha256", resolved.secret)
    .update(canonicalSealBody(payload))
    .digest("base64url");
}

export function verifySwapQuoteSeal(
  seal: unknown,
  payload: SwapQuoteSealPayload,
): boolean {
  if (!isSwapQuoteSealConfigured()) {
    return false;
  }
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
