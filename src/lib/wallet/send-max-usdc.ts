const DEFAULT_MAX_USDC = 100;

export function getWalletSendMaxUsdc(): number {
  const raw = process.env.WALLET_SEND_MAX_USDC?.trim();
  if (!raw) {
    return DEFAULT_MAX_USDC;
  }
  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return DEFAULT_MAX_USDC;
  }
  return parsed;
}
