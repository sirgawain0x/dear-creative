import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextResponse } from "next/server";
import { GET } from "./route";

vi.mock("@/lib/privy/require-auth", () => ({
  requirePrivyAuth: vi.fn(),
}));

vi.mock("@/lib/wallet/asset-transfers", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@/lib/wallet/asset-transfers")>();
  return {
    ...actual,
    fetchAlchemyAssetTransfersPage: vi.fn(),
    isWalletReadFixtureEnabled: vi.fn(() => false),
  };
});

import { requirePrivyAuth } from "@/lib/privy/require-auth";
import {
  AlchemyTransfersError,
  fetchAlchemyAssetTransfersPage,
} from "@/lib/wallet/asset-transfers";
import { setWalletEnabledForTests } from "@/lib/wallet/feature-flag";

describe("GET /api/admin/wallet/history", () => {
  beforeEach(() => {
    setWalletEnabledForTests(true);
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
    vi.unstubAllEnvs();
    vi.clearAllMocks();
  });

  it("returns 502 when Alchemy HTTP fails after auth", async () => {
    vi.mocked(fetchAlchemyAssetTransfersPage).mockRejectedValue(
      new AlchemyTransfersError("http_error", {
        httpStatus: 403,
        alchemyMessage: "Invalid API key",
      }),
    );

    const res = await GET(
      new Request("http://localhost/api/admin/wallet/history", {
        headers: { Authorization: "Bearer privy-token" },
      }),
    );

    expect(res.status).toBe(502);
    const json = await res.json();
    expect(json.error).toBe("transfer_history_unavailable");
    expect(json.code).toBe("http_error");
    expect(json.message).toBe("Invalid API key");
  });

  it("returns 403 from Privy auth gate without calling Alchemy", async () => {
    vi.mocked(requirePrivyAuth).mockResolvedValue({
      ok: false,
      response: NextResponse.json({ error: "Forbidden" }, { status: 403 }),
    });

    const res = await GET(
      new Request("http://localhost/api/admin/wallet/history"),
    );

    expect(res.status).toBe(403);
    expect(fetchAlchemyAssetTransfersPage).not.toHaveBeenCalled();
  });

  it("rejects adam/studio bearer (401)", async () => {
    vi.mocked(requirePrivyAuth).mockResolvedValue({
      ok: false,
      response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    });

    const res = await GET(
      new Request("http://localhost/api/admin/wallet/history", {
        headers: { Authorization: "Bearer studio-adam-key" },
      }),
    );

    expect(res.status).toBe(401);
    expect(requirePrivyAuth).toHaveBeenCalledWith(expect.any(Request), {
      requireAdmin: true,
    });
    expect(fetchAlchemyAssetTransfersPage).not.toHaveBeenCalled();
  });
});
