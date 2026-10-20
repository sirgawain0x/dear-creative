import { getAddress, isAddress, type Address } from "viem";

export type AdminWalletConfig =
  | { configured: true; address: Address }
  | { configured: false; reason: "unset" | "invalid" };

export function resolveAdminWalletConfig(): AdminWalletConfig {
  const raw = process.env.ADMIN_WALLET_ADDRESS?.trim();
  if (!raw) {
    return { configured: false, reason: "unset" };
  }
  if (!isAddress(raw)) {
    return { configured: false, reason: "invalid" };
  }
  return { configured: true, address: getAddress(raw) };
}
