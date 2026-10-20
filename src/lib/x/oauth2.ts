import type { XOAuth2Credentials } from "./credentials";

const TOKEN_URL = "https://api.x.com/2/oauth2/token";

export type OAuth2TokenResponse = {
  access_token: string;
  expires_in?: number;
  token_type?: string;
};

export type FetchLike = typeof fetch;

function basicAuthHeader(clientId: string, clientSecret: string): string {
  const encoded = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");
  return `Basic ${encoded}`;
}

export async function refreshOAuth2AccessToken(
  creds: XOAuth2Credentials,
  fetchFn: FetchLike,
): Promise<OAuth2TokenResponse> {
  const body = new URLSearchParams({
    grant_type: "refresh_token",
    refresh_token: creds.refreshToken,
  });

  const response = await fetchFn(TOKEN_URL, {
    method: "POST",
    headers: {
      Authorization: basicAuthHeader(creds.clientId, creds.clientSecret),
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: body.toString(),
  });

  if (!response.ok) {
    const { formatXApiFailure } = await import("./api-errors");
    throw new Error(
      `X OAuth token refresh failed: ${await formatXApiFailure(response)}`,
    );
  }

  return (await response.json()) as OAuth2TokenResponse;
}
