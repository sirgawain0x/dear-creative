let walletSendEnabledOverride: boolean | undefined;

export function setWalletSendEnabledForTests(value: boolean | undefined): void {
  walletSendEnabledOverride = value;
}

/** True only when WALLET_SEND_ENABLED is exactly the string "true". */
export function isWalletSendEnabled(): boolean {
  if (walletSendEnabledOverride !== undefined) {
    return walletSendEnabledOverride;
  }
  return process.env.WALLET_SEND_ENABLED?.trim() === "true";
}
