import { describe, expect, it } from "vitest";
import {
  LINKEDIN_OAUTH_STATE_COOKIE,
  LINKEDIN_OAUTH_STATE_COOKIE_PATH,
  buildLinkedInAuthStartResponse,
} from "./auth-response";
import { stubLinkedInOAuthEnv } from "./test-helpers";

describe("buildLinkedInAuthStartResponse", () => {
  it("sets the OAuth state cookie on the callback path", () => {
    stubLinkedInOAuthEnv();
    const res = buildLinkedInAuthStartResponse("did:privy:admin");
    const setCookie = res.headers.get("set-cookie") ?? "";
    expect(setCookie).toContain(`${LINKEDIN_OAUTH_STATE_COOKIE}=`);
    expect(setCookie).toContain(`Path=${LINKEDIN_OAUTH_STATE_COOKIE_PATH}`);
    expect(LINKEDIN_OAUTH_STATE_COOKIE_PATH).toBe(
      "/api/admin/linkedin/callback",
    );
  });
});
