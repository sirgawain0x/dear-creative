let readerWalletEnabledOverride: boolean | undefined;

export function setReaderWalletEnabledForTests(
  value: boolean | undefined,
): void {
  readerWalletEnabledOverride = value;
}

/** True only when READER_WALLET_ENABLED is exactly the string "true". */
export function isReaderWalletEnabled(): boolean {
  if (readerWalletEnabledOverride !== undefined) {
    return readerWalletEnabledOverride;
  }
  return process.env.READER_WALLET_ENABLED?.trim() === "true";
}
