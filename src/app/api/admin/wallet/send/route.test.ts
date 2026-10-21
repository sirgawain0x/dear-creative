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
  resetExecuteAdminWalletSendForTests,
  setExecuteAdminWalletSendForTests,
} from "@/lib/wallet/execute-admin-wallet-send";
import { resetSendIdempotencyStoreForTests } from "@/lib/wallet/send-idempotency";
import {
  resetWalletSendGasEstimateForTests,
  setWalletSendGasEstimateForTests,
} from "@/lib/wallet/send-gas-estimate";

vi.mock("@/lib/privy/require-auth", () => ({
  requirePrivyAuth: vi.fn(),
}));

vi.mock("@/lib/wallet/balances", () => ({
  fetchWalletBalances: vi.fn().mockResolvedValue({
    eth: { raw: "1000000000000000000", formatted: "1" },
    usdc: { raw: "5000000", formatted: "5" },
  }),
}));

import { requirePrivyAuth } from "@/lib/privy/require-auth";
import { POST } from "./route";
import { POST as POST_ESTIMATE } from "./estimate/route";

const RECIPIENT = getAddress("0x1111111111111111111111111111111111111111");

function authRequest(body: Record<string, unknown>, key = "idem-key-12345678") {
  return new Request("http://localhost/api/admin/wallet/send", {
    method: "POST",
    headers: {
      Authorization: "Bearer admin-token",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ ...body, idempotencyKey: key }),
  });
}

describe("POST /api/admin/wallet/send", () => {
  beforeEach(() => {
    setWalletEnabledForTests(true);
    setWalletSendEnabledForTests(true);
    resetSendIdempotencyStoreForTests();
    resetExecuteAdminWalletSendForTests();
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
    setExecuteAdminWalletSendForTests(async () => ({
      mode: "submitted",
      txHash: "0xabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcd",
    }));
  });

  afterEach(() => {
    setWalletEnabledForTests(undefined);
    setWalletSendEnabledForTests(undefined);
    resetExecuteAdminWalletSendForTests();
    resetSendIdempotencyStoreForTests();
    resetWalletSendGasEstimateForTests();
    vi.unstubAllEnvs();
    vi.clearAllMocks();
  });

  it("returns 404 when send flag is disabled", async () => {
    setWalletSendEnabledForTests(false);
    const res = await POST(
      authRequest({ recipient: RECIPIENT, amount: "1", asset: "USDC" }),
    );
    expect(res.status).toBe(404);
  });

  it("returns 403 for non-admin", async () => {
    vi.mocked(requirePrivyAuth).mockResolvedValue({
      ok: false,
      response: NextResponse.json({ error: "Forbidden" }, { status: 403 }),
    });
    const res = await POST(
      authRequest({ recipient: RECIPIENT, amount: "1", asset: "USDC" }),
    );
    expect(res.status).toBe(403);
  });

  it("submits send via mocked executor and returns tx hash", async () => {
    const res = await POST(
      authRequest({ recipient: RECIPIENT, amount: "1", asset: "USDC" }),
    );
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.txHash).toMatch(/^0x/);
    expect(json.explorerUrl).toContain("basescan.org/tx/");
  });

  it("returns same tx hash for duplicate idempotency key", async () => {
    const payload = { recipient: RECIPIENT, amount: "1", asset: "USDC" };
    const key = "duplicate-key-123456";
    const first = await POST(authRequest(payload, key));
    expect(first.status).toBe(200);
    const second = await POST(authRequest(payload, key));
    expect(second.status).toBe(200);
    const a = await first.json();
    const b = await second.json();
    expect(b.duplicate).toBe(true);
    expect(b.txHash).toBe(a.txHash);
  });

  it("blocks concurrent duplicate idempotency while pending", async () => {
    setExecuteAdminWalletSendForTests(
      () =>
        new Promise((resolve) => {
          setTimeout(
            () =>
              resolve({
                mode: "submitted",
                txHash:
                  "0x1111111111111111111111111111111111111111111111111111111111111111",
              }),
            50,
          );
        }),
    );
    const key = "pending-key-1234567";
    const body = { recipient: RECIPIENT, amount: "1", asset: "USDC", idempotencyKey: key };
    const p1 = POST(
      new Request("http://localhost/api/admin/wallet/send", {
        method: "POST",
        headers: {
          Authorization: "Bearer admin-token",
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      }),
    );
    await new Promise((r) => setTimeout(r, 5));
    const p2 = await POST(
      new Request("http://localhost/api/admin/wallet/send", {
        method: "POST",
        headers: {
          Authorization: "Bearer admin-token",
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      }),
    );
    expect(p2.status).toBe(409);
    await p1;
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
          asset: "USDC",
        }),
      }),
    );
    expect(res.status).toBe(404);
  });
});
