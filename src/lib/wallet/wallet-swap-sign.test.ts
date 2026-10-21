import { getAddress } from "viem";
import { describe, expect, it, vi } from "vitest";
import {
  WALLET_SWAP_SIGNATURE_TYPE_ERROR,
  WALLET_SWAP_UPGRADE_TARGET_ERROR,
} from "./swap-errors";
import { signSwapPreparedCall } from "./wallet-swap-sign";
import { buildMockSwapPreparedUserOp } from "./swap-test-prepared";

const ADMIN = getAddress("0xAE48B6dB64772b9CC24e33A79c809896776a20f6");

function mockProvider() {
  return {
    request: vi.fn(async (args: { method: string }) => {
      if (args.method === "eth_chainId") {
        return "0x2105";
      }
      if (args.method === "eth_accounts") {
        return [ADMIN];
      }
      if (args.method === "personal_sign") {
        return "0xsigned";
      }
      throw new Error(`unexpected ${args.method}`);
    }),
  };
}

describe("signSwapPreparedCall", () => {
  it("returns authorizations for array prepared payloads", async () => {
    const prepared = buildMockSwapPreparedUserOp({
      from: ADMIN,
      quote: {
        expiry: new Date(Date.now() + 60_000).toISOString(),
        minimumToAmount: "0x1",
        fromAmount: "0x1",
      },
      includeAuthorization: true,
    });

    const result = await signSwapPreparedCall({
      provider: mockProvider() as never,
      adminAddress: ADMIN,
      prepared,
      signAuthorization: async () => ({ yParity: "0x0" }),
    });

    expect(result.authorizations).toHaveLength(1);
    expect(result.signature).toBe("0xsigned");
  });

  it("rejects non-MAv2 delegation targets", async () => {
    const prepared = [
      {
        type: "eip7702-authorization",
        contractAddress: "0x69007702764179f14F51cdce752f4f775d74E139",
      },
      {
        type: "user-operation-v070",
        signatureRequest: {
          type: "personal_sign",
          data: { raw: "0x1234" },
        },
      },
    ];

    await expect(
      signSwapPreparedCall({
        provider: mockProvider() as never,
        adminAddress: ADMIN,
        prepared,
        signAuthorization: async () => ({}),
      }),
    ).rejects.toThrow(WALLET_SWAP_UPGRADE_TARGET_ERROR);
  });

  it("rejects unexpected signature request types", async () => {
    const prepared = {
      signatureRequest: {
        type: "eth_sign",
        data: { raw: "0x1234" },
      },
    };

    await expect(
      signSwapPreparedCall({
        provider: mockProvider() as never,
        adminAddress: ADMIN,
        prepared,
      }),
    ).rejects.toThrow(WALLET_SWAP_SIGNATURE_TYPE_ERROR);
  });
});
