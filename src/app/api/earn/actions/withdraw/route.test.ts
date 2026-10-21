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

describe("POST /api/earn/actions/withdraw", () => {
  beforeEach(() => {
    setEarnActionsEnabledForTests(true);
    vi.mocked(requirePrivyAuth).mockResolvedValue({
      ok: true,
      user: { userId: "did:privy:admin" },
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
      new Request("http://localhost/api/earn/actions/withdraw", {
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
      new Request("http://localhost/api/earn/actions/withdraw", {
        method: "POST",
        body: "{}",
      }),
    );
    expect(res.status).toBe(404);
  });
});
