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
};

export type WalletSendEstimate = {
  from: string;
  recipient: string;
  amount: string;
  warnings: string[];
  chain: { network: string; chainId: number };
  gas: {
    estimatedEth: string;
    gasSponsorshipAvailable: boolean;
  };
};

export type WalletSendPrepareResponse = {
  from: string;
  recipient: string;
  amount: string;
  chain: { network: string; chainId: number };
  transaction: {
    to: string;
    data: `0x${string}`;
    value: string;
    chainId: number;
  };
  gas: WalletSendEstimate["gas"];
};

export type WalletSendExecuteInput = {
  recipient: string;
  amount: string;
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
