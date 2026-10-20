import { describe, expect, it } from "vitest";
import { getAddress } from "viem";
import {
  ALCHEMY_ASSET_TRANSFER_CATEGORIES,
  buildAlchemyGetAssetTransfersRpcParams,
} from "./alchemy-get-asset-transfers-params";

const WALLET = getAddress("0xAE48B6dB64772b9CC24e33A79c809896776a20f6");

describe("buildAlchemyGetAssetTransfersRpcParams", () => {
  it("uses hex maxCount, not a decimal number", () => {
    const params = buildAlchemyGetAssetTransfersRpcParams({
      wallet: WALLET,
      direction: "in",
      maxCount: 25,
    });
    expect(params.maxCount).toBe("0x19");
    expect(typeof params.maxCount).toBe("string");
  });

  it("does not request unsupported internal category on Base", () => {
    const params = buildAlchemyGetAssetTransfersRpcParams({
      wallet: WALLET,
      direction: "out",
    });
    expect(params.category).toEqual([...ALCHEMY_ASSET_TRANSFER_CATEGORIES]);
    expect(params.category).not.toContain("internal");
  });

  it("scopes incoming transfers to toAddress", () => {
    const params = buildAlchemyGetAssetTransfersRpcParams({
      wallet: WALLET,
      direction: "in",
    });
    expect(params.toAddress).toBe(WALLET);
    expect(params.fromAddress).toBeUndefined();
  });
});
