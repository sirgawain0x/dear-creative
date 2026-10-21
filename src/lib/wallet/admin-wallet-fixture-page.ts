/**
 * Gate for `/admin/wallet-fixture` — dev-only UI for PR screenshots.
 * Never enabled on production deploys; optional `ADMIN_WALLET_FIXTURE=true` on non-dev hosts.
 */
export function isAdminWalletFixturePageEnabled(): boolean {
  if (process.env.NODE_ENV === "production") {
    return false;
  }
  if (process.env.VERCEL_ENV === "production") {
    return false;
  }
  if (process.env.NODE_ENV === "development") {
    return true;
  }
  return process.env.ADMIN_WALLET_FIXTURE?.trim().toLowerCase() === "true";
}
