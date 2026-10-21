import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextResponse } from "next/server";
import { POST } from "./route";

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

vi.mock("@/lib/earn/submit-earn-action", () => ({
  submitEarnAction: vi.fn(),
}));

import { requirePrivyAuth } from "@/lib/privy/require-auth";
import { submitEarnAction } from "@/lib/earn/submit-earn-action";
import { setEarnActionsEnabledForTests } from "@/lib/earn/actions-feature-flag";

describe("POST /api/earn/actions/deposit", () => {
  beforeEach(() => {
    setEarnActionsEnabledForTests(true);
    vi.mocked(requirePrivyAuth).mockResolvedValue({
      ok: true,
      user: { userId: "did:privy:user" },
    });
    vi.mocked(submitEarnAction).mockResolvedValue({
      ok: true,
      status: 200,
      body: { action: { id: "a1", status: "pending" } },
    });
  });

  afterEach(() => {
    setEarnActionsEnabledForTests(undefined);
    vi.clearAllMocks();
  });

  it("returns 404 when actions flag is off", async () => {
    setEarnActionsEnabledForTests(false);
    const res = await POST(
      new Request("http://localhost/api/earn/actions/deposit", {
        method: "POST",
        body: "{}",
      }),
    );
    expect(res.status).toBe(404);
  });

  it("returns 404 when unauthenticated", async () => {
    vi.mocked(requirePrivyAuth).mockResolvedValue({
      ok: false,
      response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    });
    const res = await POST(
      new Request("http://localhost/api/earn/actions/deposit", {
        method: "POST",
        body: "{}",
      }),
    );
    expect(res.status).toBe(404);
  });

  it("returns 404 for non-admin", async () => {
    vi.mocked(requirePrivyAuth).mockResolvedValue({
      ok: false,
      response: NextResponse.json({ error: "Forbidden" }, { status: 403 }),
    });
    const res = await POST(
      new Request("http://localhost/api/earn/actions/deposit", {
        method: "POST",
        body: "{}",
        headers: { Authorization: "Bearer x" },
      }),
    );
    expect(res.status).toBe(404);
  });

  it("forwards deposit submissions", async () => {
    const res = await POST(
      new Request("http://localhost/api/earn/actions/deposit", {
        method: "POST",
        headers: {
          Authorization: "Bearer token",
          "privy-authorization-signature": "sig",
          "privy-idempotency-key": "idem-1",
        },
        body: JSON.stringify({
          walletId: "w1",
          walletAddress: "0xAE48B6dB64772b9CC24e33A79c809896776a20f6",
          vaultId: "r6gja8goguw7lktlagdsh0og",
          rawAmount: "1000000",
        }),
      }),
    );
    expect(res.status).toBe(200);
    expect(res.headers.get("Cache-Control")).toBe("private, no-store");
    expect(submitEarnAction).toHaveBeenCalled();
  });
});
