import { getAddress } from "viem";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { assertPreparedFromAdmin, submitAdminSwapPreparedCall } from "./swap-submit-service";
import { resetSwapQuoteSealReplayStoreForTests } from "./swap-quote-seal-replay";
import {
  buildMockSwapPreparedUserOp,
  mockUsdcToEthQuoteFields,
  SWAP_VITEST_MOCK_ROUTER,
} from "./swap-test-prepared";
import { sealSwapQuoteForTest } from "./swap-test-seal";
import { SWAP_EXECUTE_TARGET_SELECTORS } from "./swap-constants";
import { WALLET_SWAP_QUOTE_REPLAY_ERROR } from "./swap-errors";
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
    resetSwapQuoteSealReplayStoreForTests();
    vi.unstubAllEnvs();
  });

  beforeEach(() => {
    (SWAP_EXECUTE_TARGET_SELECTORS as Record<string, string[]>)[
      SWAP_VITEST_MOCK_ROUTER.toLowerCase()
    ] = ["0x24856bc3"];
  });

  it("rejects tampered quote binding", async () => {
    vi.stubEnv("ADMIN_WALLET_ADDRESS", ADMIN);
    vi.stubEnv("WALLET_SWAP_QUOTE_SEAL_SECRET", VALID_TEST_SEAL_SECRET);
    const quote = mockUsdcToEthQuoteFields(new Date(Date.now() + 60_000).toISOString());
    const prepared = buildMockSwapPreparedUserOp({ from: ADMIN, quote });
    const seal = sealSwapQuoteForTest({
      from: ADMIN,
      direction: "USDC_TO_ETH",
      amount: "5",
      slippageBps: 50,
      quote,
      prepared,
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
    const quote = mockUsdcToEthQuoteFields(new Date(Date.now() + 60_000).toISOString());
    const prepared = buildMockSwapPreparedUserOp({
      from: ADMIN,
      quote,
      includeAuthorization: true,
    });
    const seal = sealSwapQuoteForTest({
      from: ADMIN,
      direction: "USDC_TO_ETH",
      amount: "5",
      slippageBps: 50,
      quote,
      prepared,
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

  it("rejects replayed quote seals", async () => {
    vi.stubEnv("ADMIN_WALLET_ADDRESS", ADMIN);
    vi.stubEnv("WALLET_SWAP_QUOTE_SEAL_SECRET", VALID_TEST_SEAL_SECRET);
    const quote = mockUsdcToEthQuoteFields(new Date(Date.now() + 60_000).toISOString());
    const prepared = buildMockSwapPreparedUserOp({ from: ADMIN, quote });
    const seal = sealSwapQuoteForTest({
      from: ADMIN,
      direction: "USDC_TO_ETH",
      amount: "5",
      slippageBps: 50,
      quote,
      prepared,
    });
    (prepared as Record<string, unknown>)._swapQuoteSeal = seal;

    setAlchemyWalletRpcForTests(async () => ({ id: "call-replay" }));

    const binding = {
      direction: "USDC_TO_ETH" as const,
      amount: "5",
      slippageBps: 50,
    };

    const first = await submitAdminSwapPreparedCall({
      prepared,
      signature: "0x11",
      quoteBinding: binding,
    });
    expect(first.ok).toBe(true);

    const second = await submitAdminSwapPreparedCall({
      prepared,
      signature: "0x12",
      quoteBinding: binding,
    });
    expect(second.ok).toBe(false);
    if (!second.ok) {
      expect(second.status).toBe(409);
      expect(second.error).toBe(WALLET_SWAP_QUOTE_REPLAY_ERROR);
    }
  });
});
