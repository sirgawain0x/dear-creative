const DEFAULT_MAX_USDC = 100;

export function getWalletSwapMaxUsdc(): number {
  const raw = process.env.WALLET_SWAP_MAX_USDC?.trim();
  if (!raw) {
    return DEFAULT_MAX_USDC;
  }
  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return DEFAULT_MAX_USDC;
  }
  return parsed;
}
