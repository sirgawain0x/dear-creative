import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextResponse } from "next/server";
import { setWalletEnabledForTests } from "./feature-flag";
import { setWalletSendEnabledForTests } from "./send-feature-flag";

vi.mock("@/lib/privy/require-auth", () => ({
  requirePrivyAuth: vi.fn(),
}));

import { requirePrivyAuth } from "@/lib/privy/require-auth";
import { requireAdminWalletSendApi } from "./require-admin-wallet-send-api";

describe("requireAdminWalletSendApi", () => {
  beforeEach(() => {
    setWalletEnabledForTests(true);
    setWalletSendEnabledForTests(true);
    vi.mocked(requirePrivyAuth).mockResolvedValue({
      ok: true,
      user: { userId: "did:privy:admin" },
    });
  });

  afterEach(() => {
    setWalletEnabledForTests(undefined);
    setWalletSendEnabledForTests(undefined);
    vi.clearAllMocks();
  });

  it("returns 404 when send flag is off", async () => {
    setWalletSendEnabledForTests(false);
    const result = await requireAdminWalletSendApi(
      new Request("http://localhost/api/admin/wallet/send"),
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.response.status).toBe(404);
    }
    expect(requirePrivyAuth).not.toHaveBeenCalled();
  });

  it("returns 403 for non-admin", async () => {
    vi.mocked(requirePrivyAuth).mockResolvedValue({
      ok: false,
      response: NextResponse.json({ error: "Forbidden" }, { status: 403 }),
    });
    const result = await requireAdminWalletSendApi(
      new Request("http://localhost/api/admin/wallet/send", {
        headers: { Authorization: "Bearer x" },
      }),
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.response.status).toBe(403);
    }
  });

  it("requires Privy admin auth", async () => {
    await requireAdminWalletSendApi(
      new Request("http://localhost/api/admin/wallet/send", {
        headers: { Authorization: "Bearer token" },
      }),
    );
    expect(requirePrivyAuth).toHaveBeenCalledWith(expect.any(Request), {
      requireAdmin: true,
    });
  });
});
