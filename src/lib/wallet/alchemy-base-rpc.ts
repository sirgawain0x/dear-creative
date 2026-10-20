import { SUBSCRIPTION_RPC_TIMEOUT_MS } from "@/lib/payments/subscription-config";

export function alchemyBaseMainnetRpcUrl(): string {
  const key = process.env.ALCHEMY_API_KEY?.trim();
  if (key) {
    return `https://base-mainnet.g.alchemy.com/v2/${key}`;
  }
  return "https://mainnet.base.org";
}

export const WALLET_RPC_TIMEOUT_MS = SUBSCRIPTION_RPC_TIMEOUT_MS;
