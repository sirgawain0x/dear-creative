import { getAddress, type Address } from "viem";
import type { WalletHistoryDirection } from "./asset-transfers";

/** Alchemy-supported categories on Base (no `internal`). */
export const ALCHEMY_ASSET_TRANSFER_CATEGORIES = ["external", "erc20"] as const;

export type BuildAlchemyAssetTransfersRpcParams = {
  wallet: Address;
  direction: WalletHistoryDirection;
  maxCount?: number;
  pageKey?: string;
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
  const { wallet, direction, maxCount = 25, pageKey } = params;
  const filter = directionFilter(wallet, direction);
  return {
    fromBlock: "0x0",
    toBlock: "latest",
    category: [...ALCHEMY_ASSET_TRANSFER_CATEGORIES],
    excludeZeroValue: true,
    withMetadata: true,
    order: "desc",
    maxCount: `0x${maxCount.toString(16)}`,
    ...filter,
    ...(pageKey ? { pageKey } : {}),
  };
}
