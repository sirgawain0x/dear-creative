import { NextResponse } from "next/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import { requirePrivyAuth } from "@/lib/privy/require-auth";
import { loadLinkedInPersonalCredentials } from "@/lib/linkedin/token-store";
import { GET } from "./route";

vi.mock("@/lib/privy/require-auth", () => ({
  requirePrivyAuth: vi.fn(),
}));

vi.mock("@/lib/linkedin/token-store", () => ({
  loadLinkedInPersonalCredentials: vi.fn(),
}));

describe("GET /api/admin/linkedin/status", () => {
  afterEach(() => {
    vi.mocked(requirePrivyAuth).mockReset();
    vi.mocked(loadLinkedInPersonalCredentials).mockReset();
  });

  it("returns 401 when unauthenticated", async () => {
    vi.mocked(requirePrivyAuth).mockResolvedValue({
      ok: false,
      response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    });
    const res = await GET(new Request("http://localhost/api/admin/linkedin/status"));
    expect(res.status).toBe(401);
    expect(loadLinkedInPersonalCredentials).not.toHaveBeenCalled();
  });

  it("returns 403 when authenticated but not admin", async () => {
    vi.mocked(requirePrivyAuth).mockResolvedValue({
      ok: false,
      response: NextResponse.json({ error: "Forbidden" }, { status: 403 }),
    });
    const res = await GET(
      new Request("http://localhost/api/admin/linkedin/status", {
        headers: { Authorization: "Bearer non-admin-token" },
      }),
    );
    expect(res.status).toBe(403);
    expect(requirePrivyAuth).toHaveBeenCalledWith(expect.any(Request), {
      requireAdmin: true,
    });
    expect(loadLinkedInPersonalCredentials).not.toHaveBeenCalled();
  });

  it("returns connected false when no credentials are stored", async () => {
    vi.mocked(requirePrivyAuth).mockResolvedValue({
      ok: true,
      user: { userId: "did:privy:admin-g2" },
    });
    vi.mocked(loadLinkedInPersonalCredentials).mockResolvedValue(null);
    const res = await GET(
      new Request("http://localhost/api/admin/linkedin/status", {
        headers: { Authorization: "Bearer admin-token" },
      }),
    );
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({ connected: false });
  });

  it("returns connected status without tokens", async () => {
    vi.mocked(requirePrivyAuth).mockResolvedValue({
      ok: true,
      user: { userId: "did:privy:admin-g2" },
    });
    vi.mocked(loadLinkedInPersonalCredentials).mockResolvedValue({
      id: "g2-personal",
      memberSub: "782bbtaQ",
      memberDisplayName: "Ada Lovelace",
      authorUrn: "urn:li:person:782bbtaQ",
      accessToken: "secret-access-token",
      refreshToken: "secret-refresh-token",
      expiresAtMs: 1_700_000_360_000,
    });
    const res = await GET(
      new Request("http://localhost/api/admin/linkedin/status", {
        headers: { Authorization: "Bearer admin-token" },
      }),
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({
      connected: true,
      memberName: "Ada Lovelace",
      expiresAt: new Date(1_700_000_360_000).toISOString(),
    });
    expect(JSON.stringify(body)).not.toContain("secret-access-token");
    expect(JSON.stringify(body)).not.toContain("secret-refresh-token");
  });
});
