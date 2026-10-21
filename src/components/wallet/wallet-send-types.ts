import type { AdminWalletSendAsset } from "@/lib/wallet/send-validation";

export type WalletSendAsset = AdminWalletSendAsset;

export type WalletSendBalances = {
  eth: { formatted: string };
  usdc: { formatted: string };
};

export type WalletSendContext = {
  address: string;
  chain: { network: string; chainId: number };
  balances?: WalletSendBalances;
  /** Defaults to BaseScan when omitted. */
  txExplorerUrl?: (txHash: string) => string;
};

export type WalletSendEstimateInput = {
  recipient: string;
  amount: string;
  asset: WalletSendAsset;
};

export type WalletSendEstimate = {
  recipient: string;
  amount: string;
  asset: WalletSendAsset;
  warnings: string[];
  chain: { network: string; chainId: number };
  gas: {
    estimatedEth: string;
    sponsoredByPaymaster: boolean;
  };
};

export type WalletSendExecuteInput = WalletSendEstimateInput & {
  idempotencyKey: string;
};

export type WalletSendExecuteResult =
  | { ok: true; txHash: string }
  | { ok: false; error: string };

export type WalletSendPort = {
  estimateSend: (
    input: WalletSendEstimateInput,
  ) => Promise<WalletSendEstimate | { error: string }>;
  executeSend: (input: WalletSendExecuteInput) => Promise<WalletSendExecuteResult>;
};

export function defaultBaseTxExplorerUrl(txHash: string): string {
  return `https://basescan.org/tx/${txHash}`;
}
