import type { SwapDirection } from "@/lib/wallet/swap-constants";

export type SignPreparedSwapResult = {
  signature: `0x${string}`;
  authorizations: unknown[];
};

export type WalletSwapQuoteSummary = {
  from: string;
  direction: SwapDirection;
  amount: string;
  slippageBps: number;
  chainId: number;
  needsWalletUpgrade: boolean;
  quoteSeal: string | null;
  quote: {
    expiry: string;
    minimumToAmount: string;
    fromAmount: string;
  };
  prepared: Record<string, unknown> | unknown[];
};

export type WalletSwapPort = {
  requestQuote: (input: {
    direction: SwapDirection;
    amount: string;
    slippageBps?: number;
  }) => Promise<WalletSwapQuoteSummary | { error: string }>;
  submitSwap: (input: {
    prepared: Record<string, unknown> | unknown[];
    signature: `0x${string}`;
    authorizations?: unknown[];
    direction: SwapDirection;
    amount: string;
    slippageBps: number;
  }) => Promise<{ callId: string } | { error: string }>;
  pollStatus: (callId: string) => Promise<
    | { status: number; txHash?: string }
    | { error: string }
  >;
};
