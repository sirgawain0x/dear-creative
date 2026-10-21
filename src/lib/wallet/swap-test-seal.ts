import type { Address } from "viem";
import {
  hashPreparedForSeal,
  hashSignatureRequestForSeal,
} from "./swap-prepared-digest";
import { sealSwapQuote } from "./swap-quote-seal";
import type { SwapDirection } from "./swap-constants";

export function sealSwapQuoteForTest(input: {
  from: Address;
  direction: SwapDirection;
  amount: string;
  slippageBps: number;
  quote: { expiry: string; minimumToAmount: string; fromAmount: string };
  prepared: Record<string, unknown> | unknown[];
}): string | null {
  const tx = Array.isArray(input.prepared)
    ? (input.prepared.find(
        (item) => item && typeof item === "object" && "signatureRequest" in (item as object),
      ) as Record<string, unknown> | undefined)
    : input.prepared;
  return sealSwapQuote({
    from: input.from,
    direction: input.direction,
    amount: input.amount,
    slippageBps: input.slippageBps,
    expiry: input.quote.expiry,
    fromAmount: input.quote.fromAmount,
    minimumToAmount: input.quote.minimumToAmount,
    chainId: 8453,
    preparedDigest: hashPreparedForSeal(input.prepared),
    signatureRequestDigest: hashSignatureRequestForSeal(tx?.signatureRequest ?? null),
  });
}
