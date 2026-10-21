/**
 * Gate for reader wallet fixture pages — dev-only UI for PR screenshots.
 * Never enabled on production deploys; optional `READER_WALLET_FIXTURE=true` on non-dev hosts.
 */
export function isReaderWalletFixturePageEnabled(): boolean {
  if (process.env.VERCEL_ENV === "production") {
    return false;
  }
  if (process.env.NODE_ENV === "development") {
    return true;
  }
  return process.env.READER_WALLET_FIXTURE?.trim() === "true";
}
