export type AdminPrivyWalletConfig =
  | { configured: true; walletId: string }
  | { configured: false; reason: "unset" | "invalid" };

export function resolveAdminPrivyWalletId(): AdminPrivyWalletConfig {
  const raw = process.env.ADMIN_PRIVY_WALLET_ID?.trim();
  if (!raw) {
    return { configured: false, reason: "unset" };
  }
  if (raw.length < 8) {
    return { configured: false, reason: "invalid" };
  }
  return { configured: true, walletId: raw };
}
