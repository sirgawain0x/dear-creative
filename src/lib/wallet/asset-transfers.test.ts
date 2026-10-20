import { afterEach, describe, expect, it } from "vitest";
import { getAddress } from "viem";
import {
  mergeWalletHistoryPages,
  normalizeAlchemyTransfer,
  normalizeTransferPage,
  resetAssetTransfersFetcherForTests,
  setAssetTransfersFetcherForTests,
  fetchAlchemyAssetTransfersPage,
} from "./asset-transfers";

const WALLET = getAddress("0xAE48B6dB64772b9CC24e33A79c809896776a20f6");

describe("asset transfer normalizer", () => {
  afterEach(() => {
    resetAssetTransfersFetcherForTests();
  });

  it("normalizes incoming USDC erc20 transfers", () => {
    const item = normalizeAlchemyTransfer(
      {
        uniqueId: "u1",
        hash: "0xabc",
        from: "0x0000000000000000000000000000000000000001",
        to: WALLET,
        category: "erc20",
        asset: "USDC",
        blockNum: "0x5",
        metadata: { blockTimestamp: "2026-01-01T00:00:00Z" },
        rawContract: {
          address: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
          value: "0x5f5e100",
          decimal: "0x6",
        },
        value: 100,
      },
      WALLET,
      "in",
    );
    expect(item).toMatchObject({
      direction: "in",
      asset: "USDC",
      value: "100",
    });
  });

  it("filters non-USDC erc20 transfers", () => {
    const item = normalizeAlchemyTransfer(
      {
        hash: "0xabc",
        from: "0x0000000000000000000000000000000000000001",
        to: WALLET,
        category: "erc20",
        rawContract: { address: "0x0000000000000000000000000000000000000002" },
      },
      WALLET,
      "in",
    );
    expect(item).toBeNull();
  });

  it("merges and dedupes incoming/outgoing pages by id", () => {
    const incoming = normalizeTransferPage(
      {
        transfers: [
          {
            uniqueId: "shared",
            hash: "0x1",
            from: "0x0000000000000000000000000000000000000001",
            to: WALLET,
            category: "external",
            asset: "ETH",
            blockNum: "0x2",
            value: 1,
          },
        ],
        pageKey: "in-key",
      },
      WALLET,
      "in",
    );
    const outgoing = normalizeTransferPage(
      {
        transfers: [
          {
            uniqueId: "out-only",
            hash: "0x2",
            from: WALLET,
            to: "0x0000000000000000000000000000000000000002",
            category: "external",
            asset: "ETH",
            blockNum: "0x3",
            value: 0.5,
          },
        ],
        pageKey: "out-key",
      },
      WALLET,
      "out",
    );
    const merged = mergeWalletHistoryPages(incoming.items, outgoing.items);
    expect(merged).toHaveLength(2);
    expect(incoming.pageKey).toBe("in-key");
    expect(outgoing.pageKey).toBe("out-key");
  });

  it("paginates via mocked Alchemy fetcher", async () => {
    setAssetTransfersFetcherForTests(async ({ direction, pageKey }) => {
      if (direction === "in") {
        return pageKey
          ? { transfers: [] }
          : {
              transfers: [
                {
                  uniqueId: "page1",
                  hash: "0xaaa",
                  from: "0x0000000000000000000000000000000000000001",
                  to: WALLET,
                  category: "external",
                  asset: "ETH",
                  blockNum: "0x10",
                  value: 0.1,
                },
              ],
              pageKey: "next-in",
            };
      }
      return { transfers: [] };
    });

    const first = await fetchAlchemyAssetTransfersPage({
      wallet: WALLET,
      direction: "in",
    });
    expect(first.pageKey).toBe("next-in");

    const second = await fetchAlchemyAssetTransfersPage({
      wallet: WALLET,
      direction: "in",
      pageKey: "next-in",
    });
    expect(second.transfers).toHaveLength(0);
  });
});
