export function isAdminPayoutsFixtureEnabled(): boolean {
  if (process.env.NODE_ENV === "production") {
    return false;
  }
  if (process.env.VERCEL_ENV === "production") {
    return false;
  }
  return process.env.ADMIN_PAYOUTS_FIXTURE?.trim().toLowerCase() === "true";
}

export const ADMIN_PAYOUTS_FIXTURE_SNAPSHOT = {
  payoutWalletAddress: "0x1111111111111111111111111111111111111111",
  payoutSplitAddress: "0x2222222222222222222222222222222222222222",
  treasuryAddress: "0xf46F1BA19A9280F752a451d0973b047D81c63D70",
} as const;
