let swapEnabledOverride: boolean | undefined;

export function setWalletSwapEnabledForTests(value: boolean | undefined): void {
  swapEnabledOverride = value;
}

/** True only when WALLET_SWAP_ENABLED is exactly the string "true". */
export function isWalletSwapEnabled(): boolean {
  if (swapEnabledOverride !== undefined) {
    return swapEnabledOverride;
  }
  return process.env.WALLET_SWAP_ENABLED?.trim() === "true";
}
