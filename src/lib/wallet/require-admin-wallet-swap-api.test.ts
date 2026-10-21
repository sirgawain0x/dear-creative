import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextResponse } from "next/server";
import { setWalletEnabledForTests } from "./feature-flag";
import { setWalletSwapEnabledForTests } from "./swap-feature-flag";

vi.mock("@/lib/privy/require-auth", () => ({
  requirePrivyAuth: vi.fn(),
}));

import { requirePrivyAuth } from "@/lib/privy/require-auth";
import { requireAdminWalletSwapApi } from "./require-admin-wallet-swap-api";

describe("requireAdminWalletSwapApi", () => {
  beforeEach(() => {
    setWalletEnabledForTests(true);
    setWalletSwapEnabledForTests(true);
    vi.mocked(requirePrivyAuth).mockResolvedValue({
      ok: true,
      user: { userId: "did:privy:admin" },
    });
  });

  afterEach(() => {
    setWalletEnabledForTests(undefined);
    setWalletSwapEnabledForTests(undefined);
    vi.clearAllMocks();
  });

  it("returns 404 when swap flag off", async () => {
    setWalletSwapEnabledForTests(false);
    const gate = await requireAdminWalletSwapApi(
      new Request("http://localhost/api/admin/wallet/swap/quote"),
    );
    expect(gate.ok).toBe(false);
    if (!gate.ok) {
      expect(gate.response.status).toBe(404);
    }
  });

  it("returns 403 for non-admin", async () => {
    vi.mocked(requirePrivyAuth).mockResolvedValue({
      ok: false,
      response: NextResponse.json({ error: "Forbidden" }, { status: 403 }),
    });
    const gate = await requireAdminWalletSwapApi(
      new Request("http://localhost/api/admin/wallet/swap/quote", {
        headers: { Authorization: "Bearer x" },
      }),
    );
    expect(gate.ok).toBe(false);
    if (!gate.ok) {
      expect(gate.response.status).toBe(403);
    }
  });
});
