import type { SwapDirection } from "@/lib/wallet/swap-constants";

export type WalletSwapQuoteSummary = {
  from: string;
  direction: SwapDirection;
  amount: string;
  slippageBps: number;
  chainId: number;
  needsWalletUpgrade: boolean;
  quote: {
    expiry: string;
    minimumToAmount: string;
    fromAmount: string;
  };
  prepared: Record<string, unknown>;
};

export type WalletSwapPort = {
  requestQuote: (input: {
    direction: SwapDirection;
    amount: string;
    slippageBps?: number;
  }) => Promise<WalletSwapQuoteSummary | { error: string }>;
  submitSwap: (input: {
    prepared: Record<string, unknown>;
    signature: `0x${string}`;
  }) => Promise<{ callId: string } | { error: string }>;
  pollStatus: (callId: string) => Promise<
    | { status: number; txHash?: string }
    | { error: string }
  >;
};
