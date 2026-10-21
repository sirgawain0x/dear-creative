import { NextResponse } from "next/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import { requirePrivyAuth } from "@/lib/privy/require-auth";
import { stubLinkedInOAuthEnv } from "@/lib/linkedin/test-helpers";
import { GET, LINKEDIN_OAUTH_STATE_COOKIE } from "./route";

vi.mock("@/lib/privy/require-auth", () => ({
  requirePrivyAuth: vi.fn(),
}));

describe("GET /api/admin/linkedin/auth", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.mocked(requirePrivyAuth).mockReset();
  });

  it("requires Privy admin auth", async () => {
    vi.mocked(requirePrivyAuth).mockResolvedValue({
      ok: false,
      response: NextResponse.json({ error: "Forbidden" }, { status: 403 }),
    });
    const res = await GET(new Request("http://localhost/api/admin/linkedin/auth"));
    expect(res.status).toBe(403);
    expect(requirePrivyAuth).toHaveBeenCalledWith(expect.any(Request), {
      requireAdmin: true,
    });
  });

  it("returns JSON authorization url and sets state cookie", async () => {
    stubLinkedInOAuthEnv();
    vi.mocked(requirePrivyAuth).mockResolvedValue({
      ok: true,
      user: { userId: "did:privy:admin-g2" },
    });

    const res = await GET(
      new Request("http://localhost/api/admin/linkedin/auth", {
        headers: { Authorization: "Bearer privy-token" },
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
