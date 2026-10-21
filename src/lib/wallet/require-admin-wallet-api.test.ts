import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextResponse } from "next/server";
import { setWalletEnabledForTests } from "./feature-flag";

vi.mock("@/lib/privy/require-auth", () => ({
  requirePrivyAuth: vi.fn(),
}));

import { requirePrivyAuth } from "@/lib/privy/require-auth";
import { requireAdminWalletApi } from "./require-admin-wallet-api";

describe("requireAdminWalletApi", () => {
  beforeEach(() => {
    setWalletEnabledForTests(true);
    vi.mocked(requirePrivyAuth).mockResolvedValue({
      ok: true,
      user: { userId: "did:privy:admin" },
    });
  });

  afterEach(() => {
    setWalletEnabledForTests(undefined);
    vi.clearAllMocks();
  });

  it("requires Privy admin auth (not studio/adam bearer)", async () => {
    await requireAdminWalletApi(
      new Request("http://localhost/api/admin/wallet", {
        headers: { Authorization: "Bearer adam-token" },
      }),
    );
    expect(requirePrivyAuth).toHaveBeenCalledWith(expect.any(Request), {
      requireAdmin: true,
    });
  });

  it("rejects when Privy admin auth fails", async () => {
    vi.mocked(requirePrivyAuth).mockResolvedValue({
      ok: false,
      response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    });
    const result = await requireAdminWalletApi(
      new Request("http://localhost/api/admin/wallet", {
        headers: { Authorization: "Bearer studio-key" },
      }),
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.response.status).toBe(401);
    }
  });

  it("returns 404 when wallet feature disabled", async () => {
    setWalletEnabledForTests(false);
    const result = await requireAdminWalletApi(
      new Request("http://localhost/api/admin/wallet"),
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.response.status).toBe(404);
    }
    expect(requirePrivyAuth).not.toHaveBeenCalled();
  });
});
