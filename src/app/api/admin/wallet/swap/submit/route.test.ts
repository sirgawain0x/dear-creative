import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/server", async (importOriginal) => {
  const actual = await importOriginal<typeof import("next/server")>();
  return {
    ...actual,
    connection: vi.fn(async () => {}),
  };
});

import { getAddress } from "viem";
import { BASE_USDC_ADDRESS } from "@/lib/payments/subscription-config";
import { setWalletEnabledForTests } from "@/lib/wallet/feature-flag";
import { setWalletSwapEnabledForTests } from "@/lib/wallet/swap-feature-flag";
import {
  resetAlchemyWalletRpcForTests,
  setAlchemyWalletRpcForTests,
} from "@/lib/wallet/alchemy-wallet-jsonrpc";
import { WALLET_SWAP_QUOTE_EXPIRED_ERROR } from "@/lib/wallet/swap-errors";
import { ALCHEMY_MAV2_V110 } from "@/lib/wallet/swap-constants";

vi.mock("@/lib/privy/require-auth", () => ({
  requirePrivyAuth: vi.fn(),
}));

import { requirePrivyAuth } from "@/lib/privy/require-auth";
import { POST } from "./route";

const ADMIN = getAddress("0xAE48B6dB64772b9CC24e33A79c809896776a20f6");

describe("POST /api/admin/wallet/swap/submit", () => {
  beforeEach(() => {
    setWalletEnabledForTests(true);
    setWalletSwapEnabledForTests(true);
    resetAlchemyWalletRpcForTests();
    vi.stubEnv("ADMIN_WALLET_ADDRESS", ADMIN);
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

  it("rejects expired quotes", async () => {
    const res = await POST(
      new Request("http://localhost/api/admin/wallet/swap/submit", {
        method: "POST",
        headers: {
          Authorization: "Bearer x",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          signature: "0x11",
          prepared: {
            from: ADMIN,
            quote: { expiry: "2000-01-01T00:00:00.000Z" },
            calls: [{ to: BASE_USDC_ADDRESS }, { to: ALCHEMY_MAV2_V110 }],
          },
        }),
      }),
    );
    expect(res.status).toBe(409);
    const json = await res.json();
    expect(json.error).toBe(WALLET_SWAP_QUOTE_EXPIRED_ERROR);
  });

  it("submits valid prepared swap", async () => {
    setAlchemyWalletRpcForTests(async (method) => {
      if (method === "wallet_sendPreparedCalls") {
        return { id: "call-123" };
      }
      throw new Error("unexpected");
    });
    const res = await POST(
      new Request("http://localhost/api/admin/wallet/swap/submit", {
        method: "POST",
        headers: {
          Authorization: "Bearer x",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          signature: "0x11",
          prepared: {
            from: ADMIN,
            quote: { expiry: new Date(Date.now() + 60_000).toISOString() },
            calls: [{ to: BASE_USDC_ADDRESS }, { to: ALCHEMY_MAV2_V110 }],
            type: "user-operation-v070",
          },
        }),
      }),
    );
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.callId).toBe("call-123");
  });
});
