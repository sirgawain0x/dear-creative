import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextResponse } from "next/server";
import { setWalletEnabledForTests } from "./feature-flag";

vi.mock("@/lib/adam/studio-auth", () => ({
  requireStudioOrAdamAuth: vi.fn(),
}));

import { requireStudioOrAdamAuth } from "@/lib/adam/studio-auth";
import { requireAdminWalletApi } from "./require-admin-wallet-api";

describe("requireAdminWalletApi", () => {
  beforeEach(() => {
    setWalletEnabledForTests(true);
    vi.mocked(requireStudioOrAdamAuth).mockResolvedValue({
      ok: true,
      actor: "adam-token",
      mode: "adam_token",
    });
  });

  afterEach(() => {
    setWalletEnabledForTests(undefined);
    vi.clearAllMocks();
  });

  it("accepts studio/adam bearer like other admin GET routes", async () => {
    const result = await requireAdminWalletApi(
      new Request("http://localhost/api/admin/wallet", {
        headers: { Authorization: "Bearer adam-token" },
      }),
    );
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.ctx.userId).toBe("adam-token");
    }
    expect(requireStudioOrAdamAuth).toHaveBeenCalledOnce();
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
  });

  it("forwards auth failure from requireStudioOrAdamAuth", async () => {
    vi.mocked(requireStudioOrAdamAuth).mockResolvedValue({
      ok: false,
      response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    });
    const result = await requireAdminWalletApi(
      new Request("http://localhost/api/admin/wallet"),
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.response.status).toBe(401);
    }
  });
});
