import { afterEach, describe, expect, it, vi } from "vitest";
import { LINKEDIN_OAUTH_SCOPES } from "./config";
import { setLinkedInFetchForTests } from "./http";
import {
  buildLinkedInAuthorizationUrl,
  exchangeLinkedInAuthorizationCode,
  fetchLinkedInUserInfo,
  linkedInUserInfoDisplayName,
} from "./oauth";
import { stubLinkedInOAuthEnv } from "./test-helpers";

describe("LinkedIn OAuth", () => {
  afterEach(() => {
    setLinkedInFetchForTests(undefined);
    vi.unstubAllEnvs();
  });

  it("builds authorization URL with required scopes and state", () => {
    stubLinkedInOAuthEnv();
    const url = buildLinkedInAuthorizationUrl("signed-state-value");
    expect(url.origin).toBe("https://www.linkedin.com");
    expect(url.pathname).toBe("/oauth/v2/authorization");
    expect(url.searchParams.get("response_type")).toBe("code");
    expect(url.searchParams.get("client_id")).toBe("linkedin-client-id");
    expect(url.searchParams.get("redirect_uri")).toBe(
      "https://dear.example/api/admin/linkedin/callback",
    );
    expect(url.searchParams.get("state")).toBe("signed-state-value");
    expect(url.searchParams.get("scope")).toBe(LINKEDIN_OAUTH_SCOPES);
    expect(LINKEDIN_OAUTH_SCOPES).toBe("openid profile w_member_social");
  });

  it("exchanges authorization code for tokens", async () => {
    stubLinkedInOAuthEnv();
    setLinkedInFetchForTests(async (_input, init) => {
      expect(init?.method).toBe("POST");
      const body = init?.body?.toString() ?? "";
      expect(body).toContain("grant_type=authorization_code");
      expect(body).toContain("code=auth-code-123");
      expect(body).toContain(
        "redirect_uri=https%3A%2F%2Fdear.example%2Fapi%2Fadmin%2Flinkedin%2Fcallback",
      );
      return new Response(
        JSON.stringify({
          access_token: "access-token",
          expires_in: 3600,
          refresh_token: "refresh-token",
        }),
        { status: 200 },
      );
    });
    const token = await exchangeLinkedInAuthorizationCode("auth-code-123");
    expect(token.access_token).toBe("access-token");
    expect(token.refresh_token).toBe("refresh-token");
  });

  it("loads userinfo sub for member identification", async () => {
    setLinkedInFetchForTests(async (input, init) => {
      expect(String(input)).toBe("https://api.linkedin.com/v2/userinfo");
      expect(init?.headers).toMatchObject({
        Authorization: "Bearer access-token",
      });
      return new Response(JSON.stringify({ sub: "782bbtaQ", name: "G2" }), {
        status: 200,
      });
    });
    const profile = await fetchLinkedInUserInfo("access-token");
    expect(profile.sub).toBe("782bbtaQ");
  });

  it("prefers full name from userinfo for admin status display", () => {
    expect(
      linkedInUserInfoDisplayName({
        sub: "782bbtaQ",
        given_name: "Ada",
        family_name: "Lovelace",
      }),
    ).toBe("Ada Lovelace");
    expect(
      linkedInUserInfoDisplayName({ sub: "782bbtaQ", name: " Ada Lovelace " }),
    ).toBe("Ada Lovelace");
  });
});
