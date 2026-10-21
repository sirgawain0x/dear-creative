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

vi.mock("@/lib/earn/privy-earn", () => ({
  fetchPrivyEarnVaultPosition: vi.fn(),
  PrivyEarnConfigError: class PrivyEarnConfigError extends Error {},
  PrivyEarnRequestError: class PrivyEarnRequestError extends Error {
    code = "privy_earn_upstream_error";
    status = 502;
  },
}));

import { requirePrivyAuth } from "@/lib/privy/require-auth";
import { fetchPrivyEarnVaultPosition } from "@/lib/earn/privy-earn";
import { setEarnEnabledForTests } from "@/lib/earn/feature-flag";
import { EARN_VAULT_AAVE_ID } from "@/lib/earn/vaults";

describe("GET /api/admin/earn/position", () => {
  beforeEach(() => {
    setEarnEnabledForTests(true);
    vi.stubEnv("ADMIN_PRIVY_WALLET_ID", "privy-wallet-admin-id");
    vi.mocked(requirePrivyAuth).mockResolvedValue({
      ok: true,
      user: { userId: "did:privy:admin" },
    });
    vi.mocked(fetchPrivyEarnVaultPosition).mockResolvedValue({
      asset: { address: "0x1", symbol: "usdc", decimals: 6 },
      total_deposited: "1000000000",
      total_withdrawn: "200000000",
      assets_in_vault: "850000000",
      shares_in_vault: "1",
    });
  });

  afterEach(() => {
    setEarnEnabledForTests(undefined);
    vi.unstubAllEnvs();
    vi.clearAllMocks();
  });

  it("returns 404 when earn feature is disabled", async () => {
    setEarnEnabledForTests(false);
    const res = await GET(
      new Request(
        `http://localhost/api/admin/earn/position?vault=${EARN_VAULT_AAVE_ID}`,
      ),
    );
    expect(res.status).toBe(404);
  });

  it("returns 401 when authorization token is missing", async () => {
    vi.mocked(requirePrivyAuth).mockResolvedValue({
      ok: false,
      response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    });
    const res = await GET(
      new Request(
        `http://localhost/api/admin/earn/position?vault=${EARN_VAULT_AAVE_ID}`,
      ),
    );
    expect(res.status).toBe(401);
  });

  it("returns 401 when authorization token is expired", async () => {
    vi.mocked(requirePrivyAuth).mockResolvedValue({
      ok: false,
      response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    });
    const res = await GET(
      new Request(
        `http://localhost/api/admin/earn/position?vault=${EARN_VAULT_AAVE_ID}`,
        { headers: { Authorization: "Bearer expired" } },
      ),
    );
    expect(res.status).toBe(401);
  });

  it("returns 403 for non-admin users", async () => {
    vi.mocked(requirePrivyAuth).mockResolvedValue({
      ok: false,
      response: NextResponse.json({ error: "Forbidden" }, { status: 403 }),
    });
    const res = await GET(
      new Request(
        `http://localhost/api/admin/earn/position?vault=${EARN_VAULT_AAVE_ID}`,
        { headers: { Authorization: "Bearer x" } },
      ),
    );
    expect(res.status).toBe(403);
  });

  it("rejects unknown vault ids", async () => {
    const res = await GET(
      new Request("http://localhost/api/admin/earn/position?vault=unknown"),
    );
    expect(res.status).toBe(400);
  });

  it("returns position for known vault", async () => {
    const res = await GET(
      new Request(
        `http://localhost/api/admin/earn/position?vault=${EARN_VAULT_AAVE_ID}`,
        { headers: { Authorization: "Bearer token" } },
      ),
    );
    expect(res.status).toBe(200);
    expect(res.headers.get("Cache-Control")).toBe("private, no-store");
    const json = await res.json();
    expect(json.configured).toBe(true);
    expect(json).not.toHaveProperty("walletId");
    expect(json.position.assets_in_vault).toBe("850000000");
  });
});
