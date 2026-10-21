import { describe, expect, it, vi } from "vitest";
import { NextResponse } from "next/server";
import { requireAdminEarnApi } from "./require-admin-earn-api";
import { setEarnEnabledForTests } from "./feature-flag";

vi.mock("@/lib/privy/require-auth", () => ({
  requirePrivyAuth: vi.fn(),
}));

import { requirePrivyAuth } from "@/lib/privy/require-auth";

describe("requireAdminEarnApi", () => {
  it("logs auth failure reason without returning a masked 404", async () => {
    setEarnEnabledForTests(true);
    const logSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    vi.mocked(requirePrivyAuth).mockResolvedValue({
      ok: false,
      response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    });

    const result = await requireAdminEarnApi(
      new Request("http://localhost/api/admin/earn/vaults"),
    );

    expect(result.ok).toBe(false);
    if (result.ok) {
      throw new Error("expected auth gate failure");
    }
    expect(result.response.status).toBe(401);
    expect(logSpy).toHaveBeenCalledWith("[admin-earn] auth_failed", {
      reason: "unauthorized",
      status: 401,
    });
    logSpy.mockRestore();
    setEarnEnabledForTests(undefined);
  });
});
