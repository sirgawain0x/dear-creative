import { getAddress, type Address } from "viem";
import { BASE_USDC_ADDRESS } from "@/lib/payments/subscription-config";
import type { WalletHistoryDirection } from "./asset-transfers";

/** Alchemy-supported categories on Base (no `internal`). */
export const ALCHEMY_ASSET_TRANSFER_CATEGORIES = ["external", "erc20"] as const;

export type BuildAlchemyAssetTransfersRpcParams = {
  wallet: Address;
  direction: WalletHistoryDirection;
  maxCount?: number;
  pageKey?: string;
  usdcOnly?: boolean;
};

function directionFilter(
  wallet: Address,
  direction: WalletHistoryDirection,
): { fromAddress?: string; toAddress?: string } {
  const addr = getAddress(wallet);
  if (direction === "out") {
    return { fromAddress: addr };
  }
  return { toAddress: addr };
}

export function buildAlchemyGetAssetTransfersRpcParams(
  params: BuildAlchemyAssetTransfersRpcParams,
): Record<string, unknown> {
  const { wallet, direction, maxCount = 25, pageKey, usdcOnly } = params;
  const filter = directionFilter(wallet, direction);
  return {
    fromBlock: "0x0",
    toBlock: "latest",
    category: usdcOnly ? ["erc20"] : [...ALCHEMY_ASSET_TRANSFER_CATEGORIES],
    ...(usdcOnly ? { contractAddresses: [BASE_USDC_ADDRESS] } : {}),
    excludeZeroValue: true,
    withMetadata: true,
    order: "desc",
    maxCount: `0x${maxCount.toString(16)}`,
    ...filter,
    ...(pageKey ? { pageKey } : {}),
  };
}
