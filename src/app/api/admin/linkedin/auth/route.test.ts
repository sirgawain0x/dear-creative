import { NextResponse } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { requirePrivyAdminSession } from "@/lib/privy/require-privy-admin-session";
import { stubLinkedInOAuthEnv } from "@/lib/linkedin/test-helpers";
import { GET, LINKEDIN_OAUTH_STATE_COOKIE } from "./route";

const mockCookieStore = {
  get: vi.fn(),
};

vi.mock("next/headers", () => ({
  cookies: vi.fn(async () => mockCookieStore),
}));

vi.mock("@/lib/privy/require-privy-admin-session", () => ({
  requirePrivyAdminSession: vi.fn(),
}));

describe("GET /api/admin/linkedin/auth", () => {
  beforeEach(() => {
    mockCookieStore.get.mockReturnValue(undefined);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.mocked(requirePrivyAdminSession).mockReset();
  });

  it("requires Privy admin session (cookie or bearer)", async () => {
    vi.mocked(requirePrivyAdminSession).mockResolvedValue({
      ok: false,
      response: NextResponse.json({ error: "Forbidden" }, { status: 403 }),
    });
    const res = await GET(new Request("http://localhost/api/admin/linkedin/auth"));
    expect(res.status).toBe(403);
    expect(requirePrivyAdminSession).toHaveBeenCalledWith(
      expect.any(Request),
      expect.any(Function),
    );
  });

  it("returns JSON authorization url and sets state cookie", async () => {
    stubLinkedInOAuthEnv();
    vi.mocked(requirePrivyAdminSession).mockResolvedValue({
      ok: true,
      userId: "did:privy:admin-g2",
    });

    const res = await GET(
      new Request("http://localhost/api/admin/linkedin/auth", {
        headers: { cookie: "privy-token=server-cookie-token" },
      }),
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as { url: string };
    expect(body.url).toContain("linkedin.com/oauth/v2/authorization");
    expect(body.url).toContain("scope=openid+profile+w_member_social");

    const cookie = res.headers.get("set-cookie") ?? "";
    expect(cookie).toContain(`${LINKEDIN_OAUTH_STATE_COOKIE}=`);
    expect(cookie.toLowerCase()).toContain("httponly");
  });
});
