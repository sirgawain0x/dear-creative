import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { GET } from "./route";

const ADMIN_DID = "did:privy:admin-g2";
const STATE = "signed-state-token";

const mockCookieStore = {
  get: vi.fn(),
  delete: vi.fn(),
};

vi.mock("next/headers", () => ({
  cookies: vi.fn(async () => mockCookieStore),
}));

vi.mock("@/lib/privy/require-privy-admin-session", () => ({
  resolvePrivyAdminUserForLinkedIn: vi.fn(),
}));

vi.mock("@/lib/linkedin/complete-oauth", () => ({
  completeLinkedInOAuth: vi.fn(),
}));

vi.mock("@/lib/linkedin/config", () => ({
  isLinkedInOAuthConfigured: vi.fn(() => true),
}));

import { completeLinkedInOAuth } from "@/lib/linkedin/complete-oauth";
import { resolvePrivyAdminUserForLinkedIn } from "@/lib/privy/require-privy-admin-session";

describe("GET /api/admin/linkedin/callback", () => {
  beforeEach(() => {
    mockCookieStore.get.mockImplementation((name: string) =>
      name === "linkedin_oauth_state" ? { value: STATE } : undefined,
    );
    vi.mocked(resolvePrivyAdminUserForLinkedIn).mockResolvedValue({
      userId: ADMIN_DID,
      isAdmin: true,
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("redirects to admin with connected on success", async () => {
    vi.mocked(completeLinkedInOAuth).mockResolvedValue({
      ok: true,
      reason: "connected",
    });
    const res = await GET(
      new Request(
        `http://localhost/api/admin/linkedin/callback?code=abc&state=${encodeURIComponent(STATE)}`,
        { headers: { cookie: `linkedin_oauth_state=${STATE}` } },
      ),
    );
    expect(res.status).toBe(307);
    const location = res.headers.get("location") ?? "";
    expect(location).toContain("/admin");
    expect(location).toContain("linkedin=connected");
    expect(location).not.toContain("user_cancelled");
    expect(completeLinkedInOAuth).toHaveBeenCalledWith(
      expect.objectContaining({
        privyUserId: ADMIN_DID,
        isPrivyAdmin: true,
      }),
    );
  });

  it("rejects OAuth state mismatch via completeLinkedInOAuth", async () => {
    vi.mocked(completeLinkedInOAuth).mockResolvedValue({
      ok: false,
      reason: "invalid_state",
    });
    const res = await GET(
      new Request(
        "http://localhost/api/admin/linkedin/callback?code=abc&state=bad",
      ),
    );
    const location = res.headers.get("location") ?? "";
    expect(location).toContain("reason=invalid_state");
    expect(completeLinkedInOAuth).toHaveBeenCalledWith(
      expect.objectContaining({
        state: "bad",
        cookieState: STATE,
      }),
    );
  });

  it("redirects with did_mismatch reason", async () => {
    vi.mocked(completeLinkedInOAuth).mockResolvedValue({
      ok: false,
      reason: "did_mismatch",
    });
    const res = await GET(
      new Request(
        `http://localhost/api/admin/linkedin/callback?code=abc&state=${encodeURIComponent(STATE)}`,
      ),
    );
    expect(res.headers.get("location")).toContain("reason=did_mismatch");
  });

  it("redirects with not_admin reason", async () => {
    vi.mocked(completeLinkedInOAuth).mockResolvedValue({
      ok: false,
      reason: "not_admin",
    });
    const res = await GET(
      new Request(
        `http://localhost/api/admin/linkedin/callback?code=abc&state=${encodeURIComponent(STATE)}`,
      ),
    );
    expect(res.headers.get("location")).toContain("reason=not_admin");
  });

  it("redirects with session_missing reason", async () => {
    vi.mocked(completeLinkedInOAuth).mockResolvedValue({
      ok: false,
      reason: "session_missing",
    });
    const res = await GET(
      new Request(
        `http://localhost/api/admin/linkedin/callback?code=abc&state=${encodeURIComponent(STATE)}`,
      ),
    );
    expect(res.headers.get("location")).toContain("reason=session_missing");
  });

  it("redirects with mapped LinkedIn error reason (never raw param)", async () => {
    vi.mocked(completeLinkedInOAuth).mockResolvedValue({
      ok: false,
      reason: "user_cancelled",
    });
    const res = await GET(
      new Request(
        "http://localhost/api/admin/linkedin/callback?error=user_cancelled_login",
      ),
    );
    const location = res.headers.get("location") ?? "";
    expect(location).toContain("reason=user_cancelled");
    expect(location).not.toContain("user_cancelled_login");
  });

  it("redirects with token_exchange_failed reason", async () => {
    vi.mocked(completeLinkedInOAuth).mockResolvedValue({
      ok: false,
      reason: "token_exchange_failed",
    });
    const res = await GET(
      new Request(
        `http://localhost/api/admin/linkedin/callback?code=bad&state=${encodeURIComponent(STATE)}`,
      ),
    );
    expect(res.headers.get("location")).toContain("reason=token_exchange_failed");
  });
});
