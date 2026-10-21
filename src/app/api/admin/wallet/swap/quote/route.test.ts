import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/server", async (importOriginal) => {
  const actual = await importOriginal<typeof import("next/server")>();
  return {
    ...actual,
    connection: vi.fn(async () => {}),
  };
});

import { NextResponse } from "next/server";
import { getAddress } from "viem";
import { BASE_USDC_ADDRESS } from "@/lib/payments/subscription-config";
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
import { ALCHEMY_MAV2_V110 } from "@/lib/wallet/swap-constants";

vi.mock("@/lib/privy/require-auth", () => ({
  requirePrivyAuth: vi.fn(),
}));

import { requirePrivyAuth } from "@/lib/privy/require-auth";
import { POST } from "./route";

const ADMIN = getAddress("0xAE48B6dB64772b9CC24e33A79c809896776a20f6");

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
    vi.stubEnv("ADMIN_WALLET_ADDRESS", ADMIN);
    vi.mocked(requirePrivyAuth).mockResolvedValue({
      ok: true,
      user: { userId: "did:privy:admin" },
    });
    setAlchemyWalletRpcForTests(async (method) => {
      if (method === "wallet_requestQuote_v0") {
        return {
          type: "user-operation-v070",
          quote: {
            expiry: new Date(Date.now() + 60_000).toISOString(),
            minimumToAmount: "0x5f5e100",
            fromAmount: "0x5f5e100",
          },
          calls: [{ to: BASE_USDC_ADDRESS }, { to: ALCHEMY_MAV2_V110 }],
          signatureRequest: {
            type: "personal_sign",
            data: { raw: "0x1234" },
          },
        };
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

  it("returns quote with first-swap upgrade flag", async () => {
    const res = await POST(authQuote({ direction: "USDC_TO_ETH", amount: "5" }));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.needsWalletUpgrade).toBe(true);
    expect(json.from).toBe(ADMIN);
  });

  it("rejects disallowed call targets from Alchemy", async () => {
    setAlchemyWalletRpcForTests(async () => ({
      quote: {
        expiry: new Date(Date.now() + 60_000).toISOString(),
        minimumToAmount: "0x1",
        fromAmount: "0x1",
      },
      calls: [{ to: "0x1234567890123456789012345678901234567890" }],
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
