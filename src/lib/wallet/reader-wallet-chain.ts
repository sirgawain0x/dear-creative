/** Base mainnet — required for all reader wallet reads. */
export const READER_WALLET_CHAIN_ID = 8453 as const;

export function assertReaderWalletChainId(chainId: number): void {
  if (chainId !== READER_WALLET_CHAIN_ID) {
    throw new Error("reader_wallet_wrong_chain");
  }
}

/** Chain id attached to reader wallet gate responses (Base mainnet only). */
export function resolveReaderWalletGateChainId(): typeof READER_WALLET_CHAIN_ID {
  return READER_WALLET_CHAIN_ID;
}
