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

vi.mock("@/lib/earn/wallet-access", () => ({
  assertEarnWalletAccess: vi.fn(),
}));

vi.mock("@/lib/earn/privy-earn-actions", () => ({
  fetchPrivyWalletAction: vi.fn(),
}));

import { requirePrivyAuth } from "@/lib/privy/require-auth";
import { setEarnActionsEnabledForTests } from "@/lib/earn/actions-feature-flag";

describe("GET /api/earn/actions/status", () => {
  beforeEach(() => {
    setEarnActionsEnabledForTests(true);
    vi.mocked(requirePrivyAuth).mockResolvedValue({
      ok: true,
      user: { userId: "did:privy:admin" },
    });
  });

  afterEach(() => {
    setEarnActionsEnabledForTests(undefined);
    vi.clearAllMocks();
  });

  it("returns 404 when actions flag is off", async () => {
    setEarnActionsEnabledForTests(false);
    const res = await GET(
      new Request(
        "http://localhost/api/earn/actions/status?walletId=w&walletAddress=0xAE48B6dB64772b9CC24e33A79c809896776a20f6&actionId=a1",
      ),
    );
    expect(res.status).toBe(404);
  });

  it("returns 404 for non-admin", async () => {
    vi.mocked(requirePrivyAuth).mockResolvedValue({
      ok: false,
      response: NextResponse.json({ error: "Forbidden" }, { status: 403 }),
    });
    const res = await GET(
      new Request(
        "http://localhost/api/earn/actions/status?walletId=w&walletAddress=0xAE48B6dB64772b9CC24e33A79c809896776a20f6&actionId=a1",
      ),
    );
    expect(res.status).toBe(404);
  });
});
