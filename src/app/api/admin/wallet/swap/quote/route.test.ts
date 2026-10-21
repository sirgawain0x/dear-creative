import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/server", async (importOriginal) => {
  const actual = await importOriginal<typeof import("next/server")>();
  return {
    ...actual,
    connection: vi.fn(async () => {}),
  };
});

import { NextResponse } from "next/server";
import { encodeFunctionData, getAddress } from "viem";
import { setWalletEnabledForTests } from "@/lib/wallet/feature-flag";
import { setWalletSwapEnabledForTests } from "@/lib/wallet/swap-feature-flag";
import {
  resetAlchemyWalletRpcForTests,
  setAlchemyWalletRpcForTests,
} from "@/lib/wallet/alchemy-wallet-jsonrpc";
import {
  resetSwapDelegationCheckForTests,
  setSwapDelegationCheckForTests,
} from "@/lib/wallet/swap-delegation";
import {
  resetSwapEthUsdPriceForTests,
  setSwapEthUsdPriceForTests,
} from "@/lib/wallet/swap-eth-usd-price";
import { WALLET_SWAP_FIXED_ERROR } from "@/lib/wallet/swap-errors";
import { MAV2_EXECUTE_ABI } from "@/lib/wallet/swap-mav2-abi";
import { SWAP_EXECUTE_TARGET_SELECTORS } from "@/lib/wallet/swap-constants";
import {
  buildMockSwapPreparedUserOp,
  mockUsdcToEthQuoteFields,
  SWAP_VITEST_MOCK_ROUTER,
} from "@/lib/wallet/swap-test-prepared";
import { BASE_USDC_ADDRESS } from "@/lib/payments/subscription-config";

vi.mock("@/lib/privy/require-auth", () => ({
  requirePrivyAuth: vi.fn(),
}));

import { requirePrivyAuth } from "@/lib/privy/require-auth";
import { POST } from "./route";

const ADMIN = getAddress("0xAE48B6dB64772b9CC24e33A79c809896776a20f6");

/** Test-only; never commit or configure in deployment env. */
const VALID_TEST_SEAL_SECRET = `vitest-only-${"x".repeat(32)}`;

function authQuote(body: Record<string, unknown>) {
  return new Request("http://localhost/api/admin/wallet/swap/quote", {
    method: "POST",
    headers: {
      Authorization: "Bearer admin-token",
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
}

describe("POST /api/admin/wallet/swap/quote", () => {
  beforeEach(() => {
    setWalletEnabledForTests(true);
    setWalletSwapEnabledForTests(true);
    resetAlchemyWalletRpcForTests();
    resetSwapDelegationCheckForTests();
    resetSwapEthUsdPriceForTests();
    setSwapEthUsdPriceForTests(async () => 3000);
    setSwapDelegationCheckForTests(async () => false);
    (SWAP_EXECUTE_TARGET_SELECTORS as Record<string, string[]>)[
      SWAP_VITEST_MOCK_ROUTER.toLowerCase()
    ] = ["0x24856bc3"];
    vi.stubEnv("ADMIN_WALLET_ADDRESS", ADMIN);
    vi.stubEnv("WALLET_SWAP_QUOTE_SEAL_SECRET", VALID_TEST_SEAL_SECRET);
    vi.mocked(requirePrivyAuth).mockResolvedValue({
      ok: true,
      user: { userId: "did:privy:admin" },
    });
    setAlchemyWalletRpcForTests(async (method) => {
      if (method === "wallet_requestQuote_v0") {
        return buildMockSwapPreparedUserOp({
          from: ADMIN,
          quote: mockUsdcToEthQuoteFields(new Date(Date.now() + 60_000).toISOString()),
        });
      }
      throw new Error("unexpected");
    });
  });

  afterEach(() => {
    setWalletEnabledForTests(undefined);
    setWalletSwapEnabledForTests(undefined);
    resetAlchemyWalletRpcForTests();
    resetSwapDelegationCheckForTests();
    resetSwapEthUsdPriceForTests();
    vi.unstubAllEnvs();
    vi.clearAllMocks();
  });

  it("returns 404 when swap disabled", async () => {
    setWalletSwapEnabledForTests(false);
    const res = await POST(authQuote({ direction: "USDC_TO_ETH", amount: "5" }));
    expect(res.status).toBe(404);
  });

  it("returns fixed 502 when WALLET_SWAP_QUOTE_SEAL_SECRET is unset", async () => {
    vi.unstubAllEnvs();
    vi.stubEnv("ADMIN_WALLET_ADDRESS", ADMIN);
    const res = await POST(authQuote({ direction: "USDC_TO_ETH", amount: "5" }));
    expect(res.status).toBe(502);
    const json = await res.json();
    expect(json.error).toBe(WALLET_SWAP_FIXED_ERROR);
    expect(json.quoteSeal).toBeUndefined();
  });

  it("returns fixed 502 when WALLET_SWAP_QUOTE_SEAL_SECRET is too short", async () => {
    vi.stubEnv("WALLET_SWAP_QUOTE_SEAL_SECRET", "a".repeat(31));
    const res = await POST(authQuote({ direction: "USDC_TO_ETH", amount: "5" }));
    expect(res.status).toBe(502);
    const json = await res.json();
    expect(json.error).toBe(WALLET_SWAP_FIXED_ERROR);
  });

  it("returns quote with first-swap upgrade flag and quote seal", async () => {
    const res = await POST(authQuote({ direction: "USDC_TO_ETH", amount: "5" }));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.needsWalletUpgrade).toBe(true);
    expect(json.from).toBe(ADMIN);
    expect(json.quoteSeal).toBeTruthy();
  });

  it("rejects disallowed call targets from Alchemy", async () => {
    const evil = getAddress("0x1234567890123456789012345678901234567890");
    const callData = encodeFunctionData({
      abi: MAV2_EXECUTE_ABI,
      functionName: "execute",
      args: [evil, BigInt(0), "0x095ea7b3"],
    });
    setAlchemyWalletRpcForTests(async () => ({
      type: "user-operation-v070",
      data: callData,
      quote: {
        expiry: new Date(Date.now() + 60_000).toISOString(),
        minimumToAmount: "0x1",
        fromAmount: "0x1",
      },
    }));
    const res = await POST(authQuote({ direction: "USDC_TO_ETH", amount: "5" }));
    expect(res.status).toBe(502);
  });

  it("returns fixed 502 text without leaking RPC errors", async () => {
    const secret = "https://alchemy.example/SECRET_RPC_KEY/leak";
    setAlchemyWalletRpcForTests(async () => {
      throw new Error(secret);
    });
    const res = await POST(authQuote({ direction: "USDC_TO_ETH", amount: "5" }));
    expect(res.status).toBe(502);
    const text = await res.text();
    expect(text).toContain(WALLET_SWAP_FIXED_ERROR);
    expect(text).not.toContain(secret);
  });

  it("returns 403 for non-admin", async () => {
    vi.mocked(requirePrivyAuth).mockResolvedValue({
      ok: false,
      response: NextResponse.json({ error: "Forbidden" }, { status: 403 }),
    });
    const res = await POST(authQuote({ direction: "USDC_TO_ETH", amount: "5" }));
    expect(res.status).toBe(403);
  });
});
