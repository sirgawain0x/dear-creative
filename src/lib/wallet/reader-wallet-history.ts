import type { Address } from "viem";
import {
  fetchAlchemyAssetTransfersPage,
  mergeWalletHistoryPages,
  normalizeTransferPage,
  type WalletHistoryItem,
} from "./asset-transfers";

export function filterUsdcTransfers(
  items: WalletHistoryItem[],
): WalletHistoryItem[] {
  return items.filter((item) => item.asset === "USDC");
}

export async function fetchReaderUsdcTransferHistory(params: {
  wallet: Address;
  maxCount: number;
  incomingPageKey?: string;
  outgoingPageKey?: string;
}): Promise<{
  transfers: WalletHistoryItem[];
  pagination: {
    incomingPageKey: string | null;
    outgoingPageKey: string | null;
  };
}> {
  const [incomingResult, outgoingResult] = await Promise.all([
    fetchAlchemyAssetTransfersPage({
      wallet: params.wallet,
      direction: "in",
      maxCount: params.maxCount,
      pageKey: params.incomingPageKey,
    }),
    fetchAlchemyAssetTransfersPage({
      wallet: params.wallet,
      direction: "out",
      maxCount: params.maxCount,
      pageKey: params.outgoingPageKey,
    }),
  ]);

  const incoming = normalizeTransferPage(incomingResult, params.wallet, "in");
  const outgoing = normalizeTransferPage(outgoingResult, params.wallet, "out");
  const merged = mergeWalletHistoryPages(incoming.items, outgoing.items);

  return {
    transfers: filterUsdcTransfers(merged),
    pagination: {
      incomingPageKey: incoming.pageKey ?? null,
      outgoingPageKey: outgoing.pageKey ?? null,
    },
  };
}
