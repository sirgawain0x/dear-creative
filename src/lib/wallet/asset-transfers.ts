import { getAddress, type Address } from "viem";
import {
  BASE_USDC_ADDRESS,
  USDC_DECIMALS,
} from "@/lib/payments/subscription-config";
import { alchemyBaseMainnetRpcUrl, WALLET_RPC_TIMEOUT_MS } from "./alchemy-base-rpc";

const BASE_USDC_LOWER = BASE_USDC_ADDRESS.toLowerCase();

export type WalletHistoryDirection = "in" | "out";

export type WalletHistoryItem = {
  id: string;
  direction: WalletHistoryDirection;
  category: "external" | "erc20";
  asset: "ETH" | "USDC";
  value: string;
  valueRaw: string | null;
  hash: string;
  from: Address;
  to: Address;
  blockNum: string;
  timestamp: string | null;
};

export type AlchemyAssetTransferRow = {
  uniqueId?: string;
  hash?: string;
  from?: string;
  to?: string;
  value?: number | null;
  asset?: string | null;
  category?: string;
  blockNum?: string;
  metadata?: { blockTimestamp?: string };
  rawContract?: { value?: string | null; address?: string | null; decimal?: string | null };
};

export type AlchemyAssetTransfersResult = {
  transfers: AlchemyAssetTransferRow[];
  pageKey?: string;
};

export type FetchAssetTransfersParams = {
  wallet: Address;
  direction: WalletHistoryDirection;
  maxCount?: number;
  pageKey?: string;
};

let assetTransfersFetcherOverride:
  | ((params: FetchAssetTransfersParams) => Promise<AlchemyAssetTransfersResult>)
  | null
  | undefined;

export function setAssetTransfersFetcherForTests(
  fetcher:
    | ((params: FetchAssetTransfersParams) => Promise<AlchemyAssetTransfersResult>)
    | null,
): void {
  assetTransfersFetcherOverride = fetcher;
}

export function resetAssetTransfersFetcherForTests(): void {
  assetTransfersFetcherOverride = undefined;
}

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

export async function fetchAlchemyAssetTransfersPage(
  params: FetchAssetTransfersParams,
): Promise<AlchemyAssetTransfersResult> {
  if (
    assetTransfersFetcherOverride !== undefined &&
    assetTransfersFetcherOverride !== null
  ) {
    return assetTransfersFetcherOverride(params);
  }

  const { wallet, direction, maxCount = 25, pageKey } = params;
  const filter = directionFilter(wallet, direction);

  const body = {
    jsonrpc: "2.0",
    id: 1,
    method: "alchemy_getAssetTransfers",
    params: [
      {
        fromBlock: "0x0",
        toBlock: "latest",
        category: ["external", "erc20"],
        excludeZeroValue: true,
        withMetadata: true,
        order: "desc",
        maxCount: `0x${maxCount.toString(16)}`,
        ...filter,
        ...(pageKey ? { pageKey } : {}),
      },
    ],
  };

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), WALLET_RPC_TIMEOUT_MS);

  try {
    const response = await fetch(alchemyBaseMainnetRpcUrl(), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    if (!response.ok) {
      throw new Error("alchemy_transfers_http_error");
    }
    const json = (await response.json()) as {
      result?: AlchemyAssetTransfersResult;
      error?: { message?: string };
    };
    if (json.error || !json.result) {
      throw new Error(json.error?.message ?? "alchemy_transfers_error");
    }
    return json.result;
  } finally {
    clearTimeout(timer);
  }
}

function formatTokenAmount(
  asset: "ETH" | "USDC",
  value: number | null,
  rawHex: string | null | undefined,
): { display: string; raw: string | null } {
  if (rawHex) {
    try {
      const decimals = asset === "ETH" ? 18 : USDC_DECIMALS;
      const raw = BigInt(rawHex);
      const scale = BigInt(10) ** BigInt(decimals);
      const whole = raw / scale;
      const frac = raw % scale;
      const fracStr = frac.toString().padStart(decimals, "0").replace(/0+$/, "");
      const display =
        fracStr.length > 0 ? `${whole}.${fracStr}` : whole.toString();
      return { display, raw: raw.toString() };
    } catch {
      // fall through
    }
  }
  if (value === null || value === undefined || Number.isNaN(value)) {
    return { display: "0", raw: null };
  }
  return { display: String(value), raw: null };
}

export function normalizeAlchemyTransfer(
  row: AlchemyAssetTransferRow,
  wallet: Address,
  direction: WalletHistoryDirection,
): WalletHistoryItem | null {
  if (!row.hash || !row.from || !row.to) {
    return null;
  }

  const category = row.category === "erc20" ? "erc20" : "external";
  let asset: "ETH" | "USDC" = "ETH";

  if (category === "erc20") {
    const tokenAddr = row.rawContract?.address?.toLowerCase();
    if (tokenAddr !== BASE_USDC_LOWER) {
      return null;
    }
    asset = "USDC";
  } else if (row.asset && row.asset !== "ETH") {
    return null;
  }

  const { display, raw } = formatTokenAmount(
    asset,
    row.value ?? null,
    row.rawContract?.value ?? undefined,
  );

  const id =
    row.uniqueId ??
    `${row.hash}:${direction}:${row.blockNum ?? "0"}:${row.from}:${row.to}`;

  return {
    id,
    direction,
    category,
    asset,
    value: display,
    valueRaw: raw,
    hash: row.hash,
    from: getAddress(row.from),
    to: getAddress(row.to),
    blockNum: row.blockNum ?? "0x0",
    timestamp: row.metadata?.blockTimestamp ?? null,
  };
}

export function normalizeTransferPage(
  result: AlchemyAssetTransfersResult,
  wallet: Address,
  direction: WalletHistoryDirection,
): { items: WalletHistoryItem[]; pageKey?: string } {
  const items: WalletHistoryItem[] = [];
  for (const row of result.transfers) {
    const normalized = normalizeAlchemyTransfer(row, wallet, direction);
    if (normalized) {
      items.push(normalized);
    }
  }
  return {
    items,
    pageKey: result.pageKey || undefined,
  };
}

export function mergeWalletHistoryPages(
  incoming: WalletHistoryItem[],
  outgoing: WalletHistoryItem[],
): WalletHistoryItem[] {
  const byId = new Map<string, WalletHistoryItem>();
  for (const item of [...incoming, ...outgoing]) {
    byId.set(item.id, item);
  }
  return [...byId.values()].sort((a, b) => {
    const blockA = BigInt(a.blockNum);
    const blockB = BigInt(b.blockNum);
    if (blockA === blockB) {
      return b.hash.localeCompare(a.hash);
    }
    return blockB > blockA ? 1 : -1;
  });
}

export type WalletReadFixture = {
  balances: { eth: string; usdc: string };
  history: WalletHistoryItem[];
};

export function walletReadFixtureResponse(): WalletReadFixture {
  return {
    balances: { eth: "0.042", usdc: "1250.50" },
    history: [
      {
        id: "fixture-in-usdc",
        direction: "in",
        category: "erc20",
        asset: "USDC",
        value: "100.00",
        valueRaw: "100000000",
        hash: "0x1111111111111111111111111111111111111111111111111111111111111111",
        from: getAddress("0x0000000000000000000000000000000000000001"),
        to: getAddress("0xAE48B6dB64772b9CC24e33A79c809896776a20f6"),
        blockNum: "0x10",
        timestamp: "2026-01-15T12:00:00Z",
      },
      {
        id: "fixture-out-eth",
        direction: "out",
        category: "external",
        asset: "ETH",
        value: "0.01",
        valueRaw: "10000000000000000",
        hash: "0x2222222222222222222222222222222222222222222222222222222222222222",
        from: getAddress("0xAE48B6dB64772b9CC24e33A79c809896776a20f6"),
        to: getAddress("0x0000000000000000000000000000000000000002"),
        blockNum: "0xf",
        timestamp: "2026-01-14T08:30:00Z",
      },
    ],
  };
}

export function isWalletReadFixtureEnabled(): boolean {
  if (process.env.NODE_ENV === "production") {
    return false;
  }
  if (process.env.VERCEL_ENV === "production") {
    return false;
  }
  return process.env.WALLET_READ_FIXTURE?.trim().toLowerCase() === "true";
}
