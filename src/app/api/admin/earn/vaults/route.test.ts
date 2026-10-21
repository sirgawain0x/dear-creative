import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextResponse } from "next/server";
import { GET } from "./route";

vi.mock("next/server", async (importOriginal) => {
  const actual = await importOriginal<typeof import("next/server")>();
  return {
    ...actual,
    connection: vi.fn(async () => {}),
  };
});

vi.mock("@/lib/privy/require-auth", () => ({
  requirePrivyAuth: vi.fn(),
}));

vi.mock("@/lib/earn/privy-earn", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/earn/privy-earn")>();
  return {
    ...actual,
    fetchPrivyEarnVaultDetailsBatch: vi.fn(),
  };
});

import { requirePrivyAuth } from "@/lib/privy/require-auth";
import {
  fetchPrivyEarnVaultDetailsBatch,
  PrivyEarnRequestError,
} from "@/lib/earn/privy-earn";
import { setEarnEnabledForTests } from "@/lib/earn/feature-flag";

describe("GET /api/admin/earn/vaults", () => {
  beforeEach(() => {
    setEarnEnabledForTests(true);
    vi.mocked(requirePrivyAuth).mockResolvedValue({
      ok: true,
      user: { userId: "did:privy:admin" },
    });
    vi.mocked(fetchPrivyEarnVaultDetailsBatch).mockResolvedValue([
      {
        id: "r6gja8goguw7lktlagdsh0og",
        name: "Aave USDC",
        provider: "aave",
        vault_address: "0xabc",
        asset: { address: "0x1", symbol: "usdc", decimals: 6 },
        caip2: "eip155:8453",
        user_apy: 420,
        app_apy: 80,
        tvl_usd: 100,
        available_liquidity_usd: 50,
        admin_wallet_id: "admin-w",
        admin_wallet_address: "0xadmin",
      },
    ]);
  });

  afterEach(() => {
    setEarnEnabledForTests(undefined);
    vi.clearAllMocks();
  });

  it("returns 404 when earn feature is disabled", async () => {
    setEarnEnabledForTests(false);
    const res = await GET(new Request("http://localhost/api/admin/earn/vaults"));
    expect(res.status).toBe(404);
  });

  it("returns 401 when authorization token is missing", async () => {
    vi.mocked(requirePrivyAuth).mockResolvedValue({
      ok: false,
      response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    });
    const res = await GET(new Request("http://localhost/api/admin/earn/vaults"));
    expect(res.status).toBe(401);
  });

  it("returns 401 when authorization token is expired", async () => {
    vi.mocked(requirePrivyAuth).mockResolvedValue({
      ok: false,
      response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    });
    const res = await GET(
      new Request("http://localhost/api/admin/earn/vaults", {
        headers: { Authorization: "Bearer expired" },
      }),
    );
    expect(res.status).toBe(401);
  });

  it("returns 403 for non-admin users", async () => {
    vi.mocked(requirePrivyAuth).mockResolvedValue({
      ok: false,
      response: NextResponse.json({ error: "Forbidden" }, { status: 403 }),
    });
    const res = await GET(
      new Request("http://localhost/api/admin/earn/vaults", {
        headers: { Authorization: "Bearer x" },
      }),
    );
    expect(res.status).toBe(403);
  });

  it("returns earn_vault_not_found when Privy upstream returns 404 for a vault", async () => {
    vi.mocked(fetchPrivyEarnVaultDetailsBatch).mockRejectedValue(
      new PrivyEarnRequestError(
        "earn_vault_not_found",
        502,
        "Privy Earn vault not found",
      ),
    );
    const res = await GET(
      new Request("http://localhost/api/admin/earn/vaults", {
        headers: { Authorization: "Bearer token" },
      }),
    );
    expect(res.status).toBe(502);
    const json = await res.json();
    expect(json.error).toBe("earn_vault_not_found");
  });

  it("returns vaults with private no-store cache", async () => {
    const res = await GET(
      new Request("http://localhost/api/admin/earn/vaults", {
        headers: { Authorization: "Bearer token" },
      }),
    );
    expect(res.status).toBe(200);
    expect(res.headers.get("Cache-Control")).toBe("private, no-store");
    const json = await res.json();
    expect(json.vaults).toHaveLength(1);
  });
});
