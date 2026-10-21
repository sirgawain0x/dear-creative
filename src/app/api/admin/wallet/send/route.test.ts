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
import { setWalletEnabledForTests } from "@/lib/wallet/feature-flag";
import { setWalletSendEnabledForTests } from "@/lib/wallet/send-feature-flag";
import {
  resetWalletSendGasEstimateForTests,
  setWalletSendGasEstimateForTests,
} from "@/lib/wallet/send-gas-estimate";
import { ADMIN_WALLET_SEND_VALIDATION_ERROR } from "@/lib/wallet/admin-wallet-send-request";

vi.mock("@/lib/privy/require-auth", () => ({
  requirePrivyAuth: vi.fn(),
}));

vi.mock("@/lib/wallet/balances", () => ({
  fetchWalletBalances: vi.fn().mockResolvedValue({
    eth: { raw: "1000000000000000000", formatted: "1" },
    usdc: { raw: "500000000", formatted: "500" },
  }),
}));

import { requirePrivyAuth } from "@/lib/privy/require-auth";
import { POST } from "./route";
import { POST as POST_ESTIMATE } from "./estimate/route";

const RECIPIENT = getAddress("0x1111111111111111111111111111111111111111");

function authRequest(body: Record<string, unknown>) {
  return new Request("http://localhost/api/admin/wallet/send", {
    method: "POST",
    headers: {
      Authorization: "Bearer admin-token",
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
}

describe("POST /api/admin/wallet/send", () => {
  beforeEach(() => {
    setWalletEnabledForTests(true);
    setWalletSendEnabledForTests(true);
    resetWalletSendGasEstimateForTests();
    setWalletSendGasEstimateForTests(async () => BigInt(21_000));
    vi.stubEnv(
      "ADMIN_WALLET_ADDRESS",
      "0xAE48B6dB64772b9CC24e33A79c809896776a20f6",
    );
    vi.mocked(requirePrivyAuth).mockResolvedValue({
      ok: true,
      user: { userId: "did:privy:admin" },
    });
  });

  afterEach(() => {
    setWalletEnabledForTests(undefined);
    setWalletSendEnabledForTests(undefined);
    resetWalletSendGasEstimateForTests();
    vi.unstubAllEnvs();
    vi.clearAllMocks();
  });

  it("returns 404 when send flag is disabled", async () => {
    setWalletSendEnabledForTests(false);
    const res = await POST(
      authRequest({ recipient: RECIPIENT, amount: "1" }),
    );
    expect(res.status).toBe(404);
  });

  it("returns 403 for non-admin", async () => {
    vi.mocked(requirePrivyAuth).mockResolvedValue({
      ok: false,
      response: NextResponse.json({ error: "Forbidden" }, { status: 403 }),
    });
    const res = await POST(
      authRequest({ recipient: RECIPIENT, amount: "1" }),
    );
    expect(res.status).toBe(403);
  });

  it("returns prepared USDC transaction for client signing", async () => {
    const res = await POST(
      authRequest({ recipient: RECIPIENT, amount: "1" }),
    );
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.from).toBe(getAddress("0xAE48B6dB64772b9CC24e33A79c809896776a20f6"));
    expect(json.transaction.chainId).toBe(8453);
    expect(json.transaction.data).toMatch(/^0x/);
    expect(json.gas.gasSponsorshipAvailable).toBe(false);
  });

  it("rejects amount above WALLET_SEND_MAX_USDC", async () => {
    const res = await POST(
      authRequest({ recipient: RECIPIENT, amount: "150" }),
    );
    expect(res.status).toBe(400);
  });
});

describe("POST /api/admin/wallet/send/estimate", () => {
  beforeEach(() => {
    setWalletEnabledForTests(true);
    setWalletSendEnabledForTests(true);
    resetWalletSendGasEstimateForTests();
    setWalletSendGasEstimateForTests(async () => BigInt(21_000));
    vi.stubEnv(
      "ADMIN_WALLET_ADDRESS",
      "0xAE48B6dB64772b9CC24e33A79c809896776a20f6",
    );
    vi.mocked(requirePrivyAuth).mockResolvedValue({
      ok: true,
      user: { userId: "did:privy:admin" },
    });
  });

  afterEach(() => {
    setWalletEnabledForTests(undefined);
    setWalletSendEnabledForTests(undefined);
    resetWalletSendGasEstimateForTests();
    vi.unstubAllEnvs();
  });

  it("returns 404 when send flag is disabled", async () => {
    setWalletSendEnabledForTests(false);
    const res = await POST_ESTIMATE(
      new Request("http://localhost/api/admin/wallet/send/estimate", {
        method: "POST",
        headers: { Authorization: "Bearer x", "Content-Type": "application/json" },
        body: JSON.stringify({
          recipient: RECIPIENT,
          amount: "1",
        }),
      }),
    );
    expect(res.status).toBe(404);
  });

  it("returns 502 with fixed text when gas estimate throws", async () => {
    const secret = "https://alchemy.example/SECRET_RPC_KEY/leak";
    setWalletSendGasEstimateForTests(async () => {
      throw new Error(secret);
    });
    const res = await POST_ESTIMATE(
      new Request("http://localhost/api/admin/wallet/send/estimate", {
        method: "POST",
        headers: { Authorization: "Bearer x", "Content-Type": "application/json" },
        body: JSON.stringify({
          recipient: RECIPIENT,
          amount: "1",
        }),
      }),
    );
    expect(res.status).toBe(502);
    const text = await res.text();
    expect(text).toContain(ADMIN_WALLET_SEND_VALIDATION_ERROR);
    expect(text).not.toContain(secret);
  });
});
