let walletEnabledOverride: boolean | undefined;

export function setWalletEnabledForTests(value: boolean | undefined): void {
  walletEnabledOverride = value;
}

export function isWalletEnabled(): boolean {
  if (walletEnabledOverride !== undefined) {
    return walletEnabledOverride;
  }
  return process.env.WALLET_ENABLED?.trim().toLowerCase() === "true";
}
