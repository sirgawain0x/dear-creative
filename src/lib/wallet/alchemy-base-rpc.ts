import { SUBSCRIPTION_RPC_TIMEOUT_MS } from "@/lib/payments/subscription-config";

/** Server-only env var used for Base mainnet RPC + Alchemy NFT/transfers APIs. */
export const ALCHEMY_API_KEY_ENV = "ALCHEMY_API_KEY" as const;

export function alchemyBaseMainnetRpcUrl(): string {
  const key = process.env[ALCHEMY_API_KEY_ENV]?.trim();
  if (key) {
    return `https://base-mainnet.g.alchemy.com/v2/${key}`;
  }
  return "https://mainnet.base.org";
}

export const WALLET_RPC_TIMEOUT_MS = SUBSCRIPTION_RPC_TIMEOUT_MS;
