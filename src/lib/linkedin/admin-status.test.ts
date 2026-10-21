import { describe, expect, it } from "vitest";
import { toLinkedInAdminConnectionStatus } from "./admin-status";

describe("toLinkedInAdminConnectionStatus", () => {
  it("returns disconnected when credentials are missing", () => {
    expect(toLinkedInAdminConnectionStatus(null)).toEqual({ connected: false });
  });

  it("maps stored credentials to a public status shape", () => {
    expect(
      toLinkedInAdminConnectionStatus({
        id: "g2-personal",
        memberSub: "782bbtaQ",
        authorUrn: "urn:li:person:782bbtaQ",
        accessToken: "secret",
        refreshToken: null,
        expiresAtMs: 1_700_000_000_000,
      }),
    ).toEqual({
      connected: true,
      expiresAt: new Date(1_700_000_000_000).toISOString(),
    });
  });
});
