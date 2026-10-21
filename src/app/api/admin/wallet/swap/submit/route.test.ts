import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/server", async (importOriginal) => {
  const actual = await importOriginal<typeof import("next/server")>();
  return {
    ...actual,
    connection: vi.fn(async () => {}),
  };
});

import { getAddress } from "viem";
import { setWalletEnabledForTests } from "@/lib/wallet/feature-flag";
import { setWalletSwapEnabledForTests } from "@/lib/wallet/swap-feature-flag";
import {
  resetAlchemyWalletRpcForTests,
  setAlchemyWalletRpcForTests,
} from "@/lib/wallet/alchemy-wallet-jsonrpc";
import {
  WALLET_SWAP_FIXED_ERROR,
  WALLET_SWAP_QUOTE_BINDING_ERROR,
  WALLET_SWAP_QUOTE_EXPIRED_ERROR,
} from "@/lib/wallet/swap-errors";
import { sealSwapQuote } from "@/lib/wallet/swap-quote-seal";
import { buildMockSwapPreparedUserOp } from "@/lib/wallet/swap-test-prepared";

vi.mock("@/lib/privy/require-auth", () => ({
  requirePrivyAuth: vi.fn(),
}));

import { requirePrivyAuth } from "@/lib/privy/require-auth";
import { POST } from "./route";

const ADMIN = getAddress("0xAE48B6dB64772b9CC24e33A79c809896776a20f6");

/** Test-only; never commit or configure in deployment env. */
const VALID_TEST_SEAL_SECRET = `vitest-only-${"x".repeat(32)}`;

function submitBody(overrides: Record<string, unknown>) {
  return new Request("http://localhost/api/admin/wallet/swap/submit", {
    method: "POST",
    headers: {
      Authorization: "Bearer x",
      "Content-Type": "application/json",
    },
    body: JSON.stringify(overrides),
  });
}

function buildSealedPrepared(amount = "5") {
  const quote = {
    expiry: new Date(Date.now() + 60_000).toISOString(),
    minimumToAmount: "0x5f5e100",
    fromAmount: "0x5f5e100",
  };
  const prepared = buildMockSwapPreparedUserOp({ from: ADMIN, quote });
  const seal = sealSwapQuote({
    from: ADMIN,
    direction: "USDC_TO_ETH",
    amount,
    slippageBps: 50,
    ...quote,
  });
  (prepared as Record<string, unknown>)._swapQuoteSeal = seal;
  return { prepared, quote, amount };
}

describe("POST /api/admin/wallet/swap/submit", () => {
  beforeEach(() => {
    setWalletEnabledForTests(true);
    setWalletSwapEnabledForTests(true);
    resetAlchemyWalletRpcForTests();
    vi.stubEnv("ADMIN_WALLET_ADDRESS", ADMIN);
    vi.stubEnv("WALLET_SWAP_QUOTE_SEAL_SECRET", VALID_TEST_SEAL_SECRET);
    vi.mocked(requirePrivyAuth).mockResolvedValue({
      ok: true,
      user: { userId: "did:privy:admin" },
    });
  });

  afterEach(() => {
    setWalletEnabledForTests(undefined);
    setWalletSwapEnabledForTests(undefined);
    resetAlchemyWalletRpcForTests();
    vi.unstubAllEnvs();
  });

  it("returns fixed 502 when WALLET_SWAP_QUOTE_SEAL_SECRET is unset", async () => {
    vi.unstubAllEnvs();
    vi.stubEnv("ADMIN_WALLET_ADDRESS", ADMIN);
    const { prepared } = buildSealedPrepared("5");
    const res = await POST(
      submitBody({
        signature: "0x11",
        prepared,
        direction: "USDC_TO_ETH",
        amount: "5",
        slippageBps: 50,
      }),
    );
    expect(res.status).toBe(502);
    const json = await res.json();
    expect(json.error).toBe(WALLET_SWAP_FIXED_ERROR);
  });

  it("returns fixed 502 when WALLET_SWAP_QUOTE_SEAL_SECRET is too short", async () => {
    vi.stubEnv("WALLET_SWAP_QUOTE_SEAL_SECRET", "b".repeat(31));
    const { prepared } = buildSealedPrepared("5");
    const res = await POST(
      submitBody({
        signature: "0x11",
        prepared,
        direction: "USDC_TO_ETH",
        amount: "5",
        slippageBps: 50,
      }),
    );
    expect(res.status).toBe(502);
    const json = await res.json();
    expect(json.error).toBe(WALLET_SWAP_FIXED_ERROR);
  });

  it("rejects expired quotes", async () => {
    const quote = {
      expiry: "2000-01-01T00:00:00.000Z",
      minimumToAmount: "0x1",
      fromAmount: "0x1",
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

    const res = await POST(
      submitBody({
        signature: "0x11",
        prepared,
        direction: "USDC_TO_ETH",
        amount: "5",
        slippageBps: 50,
      }),
    );
    expect(res.status).toBe(409);
    const json = await res.json();
    expect(json.error).toBe(WALLET_SWAP_QUOTE_EXPIRED_ERROR);
  });

  it("rejects missing from on prepared payload", async () => {
    const res = await POST(
      submitBody({
        signature: "0x11",
        prepared: {
          quote: {
            expiry: new Date(Date.now() + 60_000).toISOString(),
            minimumToAmount: "0x1",
            fromAmount: "0x1",
          },
        },
        direction: "USDC_TO_ETH",
        amount: "5",
        slippageBps: 50,
      }),
    );
    expect(res.status).toBe(400);
  });

  it("rejects tampered quote binding", async () => {
    const { prepared } = buildSealedPrepared("5");
    const res = await POST(
      submitBody({
        signature: "0x11",
        prepared,
        direction: "USDC_TO_ETH",
        amount: "10",
        slippageBps: 50,
      }),
    );
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toBe(WALLET_SWAP_QUOTE_BINDING_ERROR);
  });

  it("submits valid prepared swap and forwards authorizations", async () => {
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
        return { id: "call-123" };
      }
      throw new Error("unexpected");
    });

    const res = await POST(
      submitBody({
        signature: "0x11",
        authorizations: [{ signed: "7702-auth" }],
        prepared,
        direction: "USDC_TO_ETH",
        amount: "5",
        slippageBps: 50,
      }),
    );
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.callId).toBe("call-123");
    const sent = captured as unknown[];
    expect(sent[0]).toEqual({ signed: "7702-auth" });
  });
});
