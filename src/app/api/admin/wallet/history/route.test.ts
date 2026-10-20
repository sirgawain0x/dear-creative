import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextResponse } from "next/server";
import { GET } from "./route";

vi.mock("@/lib/adam/studio-auth", () => ({
  requireStudioOrAdamAuth: vi.fn(),
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

import { requireStudioOrAdamAuth } from "@/lib/adam/studio-auth";
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
    vi.mocked(requireStudioOrAdamAuth).mockResolvedValue({
      ok: true,
      actor: "did:privy:admin",
      mode: "privy_admin",
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

  it("returns 403 from auth gate without calling Alchemy", async () => {
    vi.mocked(requireStudioOrAdamAuth).mockResolvedValue({
      ok: false,
      response: NextResponse.json({ error: "Forbidden" }, { status: 403 }),
    });

    const res = await GET(
      new Request("http://localhost/api/admin/wallet/history"),
    );

    expect(res.status).toBe(403);
    expect(fetchAlchemyAssetTransfersPage).not.toHaveBeenCalled();
  });
});
