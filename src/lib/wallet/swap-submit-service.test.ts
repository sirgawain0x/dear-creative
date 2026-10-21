import { getAddress } from "viem";
import { afterEach, describe, expect, it, vi } from "vitest";
import { assertPreparedFromAdmin, submitAdminSwapPreparedCall } from "./swap-submit-service";
import { sealSwapQuote } from "./swap-quote-seal";
import { buildMockSwapPreparedUserOp } from "./swap-test-prepared";
import {
  resetAlchemyWalletRpcForTests,
  setAlchemyWalletRpcForTests,
} from "./alchemy-wallet-jsonrpc";

const ADMIN = getAddress("0xAE48B6dB64772b9CC24e33A79c809896776a20f6");

const VALID_TEST_SEAL_SECRET = `vitest-only-${"x".repeat(32)}`;

describe("assertPreparedFromAdmin", () => {
  it("fails closed when from is missing", () => {
    expect(
      assertPreparedFromAdmin(
        { quote: { expiry: "x", fromAmount: "0x1", minimumToAmount: "0x1" } },
        ADMIN,
      ),
    ).toBe(false);
  });

  it("accepts matching from on prepared object", () => {
    expect(assertPreparedFromAdmin({ from: ADMIN }, ADMIN)).toBe(true);
  });
});

describe("submitAdminSwapPreparedCall", () => {
  afterEach(() => {
    resetAlchemyWalletRpcForTests();
    vi.unstubAllEnvs();
  });

  it("rejects tampered quote binding", async () => {
    vi.stubEnv("ADMIN_WALLET_ADDRESS", ADMIN);
    vi.stubEnv("WALLET_SWAP_QUOTE_SEAL_SECRET", VALID_TEST_SEAL_SECRET);
    const quote = {
      expiry: new Date(Date.now() + 60_000).toISOString(),
      minimumToAmount: "0x5f5e100",
      fromAmount: "0x5f5e100",
    };
    const prepared = buildMockSwapPreparedUserOp({ from: ADMIN, quote });
    const seal = sealSwapQuote({
      from: ADMIN,
      direction: "USDC_TO_ETH",
      amount: "5",
      slippageBps: 50,
      ...quote,
    });
    (prepared as Record<string, unknown>)._swapQuoteSeal = seal;

    const result = await submitAdminSwapPreparedCall({
      prepared,
      signature: "0x11",
      quoteBinding: {
        direction: "USDC_TO_ETH",
        amount: "10",
        slippageBps: 50,
      },
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.status).toBe(400);
    }
  });

  it("forwards signed authorizations to wallet_sendPreparedCalls", async () => {
    vi.stubEnv("ADMIN_WALLET_ADDRESS", ADMIN);
    vi.stubEnv("WALLET_SWAP_QUOTE_SEAL_SECRET", VALID_TEST_SEAL_SECRET);
    const quote = {
      expiry: new Date(Date.now() + 60_000).toISOString(),
      minimumToAmount: "0x5f5e100",
      fromAmount: "0x5f5e100",
    };
    const prepared = buildMockSwapPreparedUserOp({
      from: ADMIN,
      quote,
      includeAuthorization: true,
    });
    const seal = sealSwapQuote({
      from: ADMIN,
      direction: "USDC_TO_ETH",
      amount: "5",
      slippageBps: 50,
      ...quote,
    });
    const txItem = (prepared as unknown[])[1] as Record<string, unknown>;
    txItem._swapQuoteSeal = seal;

    let captured: unknown = undefined;
    setAlchemyWalletRpcForTests(async (method, params) => {
      if (method === "wallet_sendPreparedCalls") {
        captured = Array.isArray(params) ? params[0] : undefined;
        return { id: "call-7702" };
      }
      throw new Error("unexpected");
    });

    const signedAuth = { contractAddress: ADMIN, nonce: 0 };
    const result = await submitAdminSwapPreparedCall({
      prepared,
      signature: "0x22",
      authorizations: [signedAuth],
      quoteBinding: {
        direction: "USDC_TO_ETH",
        amount: "5",
        slippageBps: 50,
      },
    });

    expect(result.ok).toBe(true);
    expect(Array.isArray(captured)).toBe(true);
    const sent = captured as unknown[];
    expect(sent[0]).toEqual(signedAuth);
    expect(sent[1]).toMatchObject({
      signature: { type: "secp256k1", data: "0x22" },
    });
  });
});
