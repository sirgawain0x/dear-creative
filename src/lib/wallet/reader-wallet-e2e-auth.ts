/** Playwright / local capture only — never enable in production deploys. */
export const READER_WALLET_E2E_STORAGE_KEY = "dear_creative_reader_wallet_e2e";

/** Server-only: gate before passing `readerWalletE2eAuthEnabled` into the client tree. */
export function isReaderWalletE2eAuthEnabled(): boolean {
  if (process.env.VERCEL_ENV === "production") {
    return false;
  }
  if (process.env.READER_WALLET_E2E_AUTH?.trim() === "true") {
    return true;
  }
  if (
    process.env.CI === "true" &&
    process.env.READER_WALLET_ENABLED?.trim() === "true"
  ) {
    return true;
  }
  return false;
}

export function isReaderWalletE2eSessionActive(
  readerWalletE2eAuthEnabled: boolean,
): boolean {
  if (!readerWalletE2eAuthEnabled) {
    return false;
  }
  if (typeof window === "undefined") {
    return false;
  }
  return window.localStorage.getItem(READER_WALLET_E2E_STORAGE_KEY) === "1";
}
