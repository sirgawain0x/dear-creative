import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextResponse } from "next/server";
import { setEarnActionsEnabledForTests } from "./actions-feature-flag";
import { requireEarnActionsApi } from "./require-earn-actions-api";

vi.mock("@/lib/privy/require-auth", () => ({
  requirePrivyAuth: vi.fn(),
}));

import { requirePrivyAuth } from "@/lib/privy/require-auth";

describe("requireEarnActionsApi", () => {
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
    const gate = await requireEarnActionsApi(
      new Request("http://localhost/api/earn/actions/deposit"),
    );
    expect(gate.ok).toBe(false);
    if (!gate.ok) {
      expect(gate.response.status).toBe(404);
    }
  });

  it("returns 404 for unauthenticated requests", async () => {
    vi.mocked(requirePrivyAuth).mockResolvedValue({
      ok: false,
      response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    });
    const gate = await requireEarnActionsApi(
      new Request("http://localhost/api/earn/actions/deposit"),
    );
    expect(gate.ok).toBe(false);
    if (!gate.ok) {
      expect(gate.response.status).toBe(404);
    }
  });

  it("returns 404 for non-admin users", async () => {
    vi.mocked(requirePrivyAuth).mockResolvedValue({
      ok: false,
      response: NextResponse.json({ error: "Forbidden" }, { status: 403 }),
    });
    const gate = await requireEarnActionsApi(
      new Request("http://localhost/api/earn/actions/deposit"),
    );
    expect(gate.ok).toBe(false);
    if (!gate.ok) {
      expect(gate.response.status).toBe(404);
    }
  });
});
