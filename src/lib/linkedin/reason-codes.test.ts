import { describe, expect, it } from "vitest";
import { mapLinkedInOAuthErrorParam } from "./reason-codes";

describe("mapLinkedInOAuthErrorParam", () => {
  it("maps known LinkedIn OAuth errors to stable reason codes", () => {
    expect(mapLinkedInOAuthErrorParam("user_cancelled_login")).toBe(
      "user_cancelled",
    );
    expect(mapLinkedInOAuthErrorParam("user_cancelled_authorize")).toBe(
      "user_cancelled",
    );
    expect(mapLinkedInOAuthErrorParam("access_denied")).toBe("access_denied");
    expect(mapLinkedInOAuthErrorParam("invalid_request")).toBe(
      "oauth_invalid_request",
    );
  });

  it("never returns raw provider error strings", () => {
    expect(mapLinkedInOAuthErrorParam("some_unknown_xyz")).toBe("oauth_denied");
    expect(mapLinkedInOAuthErrorParam("some_unknown_xyz")).not.toContain("xyz");
  });
});
