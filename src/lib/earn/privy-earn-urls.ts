export const PRIVY_WALLET_API_BASE = "https://api.privy.io/api/v1";

export function privyEarnDepositUrl(walletId: string): string {
  return `${PRIVY_WALLET_API_BASE}/wallets/${encodeURIComponent(walletId)}/earn/ethereum/deposit`;
}

export function privyEarnWithdrawUrl(walletId: string): string {
  return `${PRIVY_WALLET_API_BASE}/wallets/${encodeURIComponent(walletId)}/earn/ethereum/withdraw`;
}

export function privyWalletActionUrl(
  walletId: string,
  actionId: string,
): string {
  return `${PRIVY_WALLET_API_BASE}/wallets/${encodeURIComponent(walletId)}/actions/${encodeURIComponent(actionId)}`;
}
