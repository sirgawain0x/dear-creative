import { NextResponse } from "next/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import { requirePrivyAuth } from "@/lib/privy/require-auth";
import { stubLinkedInOAuthEnv } from "@/lib/linkedin/test-helpers";
import { createLinkedInOAuthState } from "@/lib/linkedin/oauth-state";
import { GET, LINKEDIN_OAUTH_STATE_COOKIE } from "./route";

vi.mock("@/lib/privy/require-auth", () => ({
  requirePrivyAuth: vi.fn(),
}));

vi.mock("@/lib/linkedin/oauth-state", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/linkedin/oauth-state")>();
  return {
    ...actual,
    createLinkedInOAuthState: vi.fn(actual.createLinkedInOAuthState),
  };
});

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

  it("redirects to LinkedIn with OAuth state cookie", async () => {
    stubLinkedInOAuthEnv();
    vi.mocked(requirePrivyAuth).mockResolvedValue({
      ok: true,
      user: { userId: "did:privy:admin" },
    });
    const fixedState = createLinkedInOAuthState(1_700_000_000_000);
    vi.mocked(createLinkedInOAuthState).mockReturnValue(fixedState);

    const res = await GET(new Request("http://localhost/api/admin/linkedin/auth"));
    expect(res.status).toBe(307);
    const location = res.headers.get("location");
    expect(location).toContain("linkedin.com/oauth/v2/authorization");
    expect(location).toContain("scope=openid+profile+w_member_social");
    expect(location).toContain(`state=${encodeURIComponent(fixedState)}`);

    const cookie = res.headers.get("set-cookie") ?? "";
    expect(cookie).toContain(`${LINKEDIN_OAUTH_STATE_COOKIE}=`);
    expect(cookie.toLowerCase()).toContain("httponly");
  });
});
