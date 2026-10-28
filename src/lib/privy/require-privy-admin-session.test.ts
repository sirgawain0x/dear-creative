import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getPrivyUserIdFromCookies } from "./session-from-cookies";
import {
  requirePrivyAdminSession,
  resolvePrivyAdminUserForLinkedIn,
} from "./require-privy-admin-session";
import {
  resetPrivyTokenVerifierForTests,
  setPrivyTokenVerifierForTests,
} from "./verify";

vi.mock("./session-from-cookies", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("./session-from-cookies")>();
  return {
    ...actual,
    getPrivyUserIdFromCookies: vi.fn(),
  };
});

const ADMIN_DID = "did:privy:admin-g2";
const NON_ADMIN_DID = "did:privy:reader";

describe("requirePrivyAdminSession", () => {
  beforeEach(() => {
    vi.mocked(getPrivyUserIdFromCookies).mockReset();
  });

  afterEach(() => {
    resetPrivyTokenVerifierForTests();
    vi.unstubAllEnvs();
  });

  it("accepts a valid privy-token cookie for an admin", async () => {
    vi.stubEnv("PRIVY_ADMIN_USER_IDS", ADMIN_DID);
    vi.mocked(getPrivyUserIdFromCookies).mockResolvedValue(ADMIN_DID);

    const result = await requirePrivyAdminSession(
      new Request("http://localhost/api/admin/linkedin/auth"),
      () => "cookie-access-token",
    );
    expect(result).toEqual({ ok: true, userId: ADMIN_DID });
  });

  it("falls back to Authorization bearer when cookie session is missing", async () => {
    vi.stubEnv("PRIVY_ADMIN_USER_IDS", ADMIN_DID);
    vi.mocked(getPrivyUserIdFromCookies).mockResolvedValue(null);
    setPrivyTokenVerifierForTests({
      verifyAuthToken: vi.fn(async (token: string) => {
        expect(token).toBe("header-access-token");
        return {
          userId: ADMIN_DID,
          appId: "app",
          issuer: "privy",
          issuedAt: 0,
          expiration: 0,
          sessionId: "sess",
        };
      }),
    });

    const result = await requirePrivyAdminSession(
      new Request("http://localhost/api/admin/linkedin/auth", {
        headers: { Authorization: "Bearer header-access-token" },
      }),
      () => undefined,
    );
    expect(result).toEqual({ ok: true, userId: ADMIN_DID });
  });

  it("returns 401 when cookie and header are missing or invalid", async () => {
    vi.stubEnv("PRIVY_ADMIN_USER_IDS", ADMIN_DID);
    vi.mocked(getPrivyUserIdFromCookies).mockResolvedValue(null);

    const missing = await requirePrivyAdminSession(
      new Request("http://localhost/api/admin/linkedin/auth"),
      () => undefined,
    );
    expect(missing.ok).toBe(false);
    if (!missing.ok) {
      expect(missing.response.status).toBe(401);
    }

    setPrivyTokenVerifierForTests({
      verifyAuthToken: vi.fn(async () => {
        throw new Error("invalid");
      }),
    });
    const invalidHeader = await requirePrivyAdminSession(
      new Request("http://localhost/api/admin/linkedin/auth", {
        headers: { Authorization: "Bearer bad-token" },
      }),
      () => undefined,
    );
    expect(invalidHeader.ok).toBe(false);
    if (!invalidHeader.ok) {
      expect(invalidHeader.response.status).toBe(401);
    }
  });

  it("returns 403 for authenticated non-admin users", async () => {
    vi.stubEnv("PRIVY_ADMIN_USER_IDS", ADMIN_DID);
    vi.mocked(getPrivyUserIdFromCookies).mockResolvedValue(null);
    setPrivyTokenVerifierForTests({
      verifyAuthToken: vi.fn(async () => ({
        userId: NON_ADMIN_DID,
        appId: "app",
        issuer: "privy",
        issuedAt: 0,
        expiration: 0,
        sessionId: "sess",
      })),
    });

    const result = await requirePrivyAdminSession(
      new Request("http://localhost/api/admin/linkedin/auth", {
        headers: { Authorization: "Bearer reader-token" },
      }),
      () => undefined,
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.response.status).toBe(403);
    }
  });
});

describe("resolvePrivyAdminUserForLinkedIn", () => {
  beforeEach(() => {
    vi.mocked(getPrivyUserIdFromCookies).mockReset();
  });

  afterEach(() => {
    resetPrivyTokenVerifierForTests();
    vi.unstubAllEnvs();
  });

  it("marks non-admin sessions for callback handling", async () => {
    vi.stubEnv("PRIVY_ADMIN_USER_IDS", ADMIN_DID);
    vi.mocked(getPrivyUserIdFromCookies).mockResolvedValue(NON_ADMIN_DID);

    const resolved = await resolvePrivyAdminUserForLinkedIn(
      new Request("http://localhost/callback"),
      () => undefined,
    );
    expect(resolved).toEqual({ userId: NON_ADMIN_DID, isAdmin: false });
  });
});
