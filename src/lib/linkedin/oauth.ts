import {
  getLinkedInClientId,
  getLinkedInClientSecret,
  getLinkedInRedirectUri,
  LINKEDIN_ACCESS_TOKEN_URL,
  LINKEDIN_AUTHORIZATION_URL,
  LINKEDIN_OAUTH_SCOPES,
  LINKEDIN_USERINFO_URL,
} from "./config";
import { linkedInFetch } from "./http";

export type LinkedInTokenResponse = {
  access_token: string;
  expires_in?: number;
  refresh_token?: string;
  refresh_token_expires_in?: number;
  scope?: string;
  token_type?: string;
};

export type LinkedInUserInfo = {
  sub: string;
  name?: string;
  given_name?: string;
  family_name?: string;
};

export function buildLinkedInAuthorizationUrl(state: string): URL {
  const clientId = getLinkedInClientId();
  const redirectUri = getLinkedInRedirectUri();
  if (!clientId || !redirectUri) {
    throw new Error("linkedin_oauth_not_configured");
  }
  const url = new URL(LINKEDIN_AUTHORIZATION_URL);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("client_id", clientId);
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("state", state);
  url.searchParams.set("scope", LINKEDIN_OAUTH_SCOPES);
  return url;
}

export async function exchangeLinkedInAuthorizationCode(
  code: string,
): Promise<LinkedInTokenResponse> {
  const clientId = getLinkedInClientId();
  const clientSecret = getLinkedInClientSecret();
  const redirectUri = getLinkedInRedirectUri();
  if (!clientId || !clientSecret || !redirectUri) {
    throw new Error("linkedin_oauth_not_configured");
  }
  const body = new URLSearchParams({
    grant_type: "authorization_code",
    code,
    redirect_uri: redirectUri,
    client_id: clientId,
    client_secret: clientSecret,
  });
  const res = await linkedInFetch(LINKEDIN_ACCESS_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  if (!res.ok) {
    throw new Error("linkedin_token_exchange_failed");
  }
  return (await res.json()) as LinkedInTokenResponse;
}

export async function fetchLinkedInUserInfo(
  accessToken: string,
): Promise<LinkedInUserInfo> {
  const res = await linkedInFetch(LINKEDIN_USERINFO_URL, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) {
    throw new Error("linkedin_userinfo_failed");
  }
  const data = (await res.json()) as LinkedInUserInfo;
  if (!data.sub?.trim()) {
    throw new Error("linkedin_userinfo_missing_sub");
  }
  return data;
}
