export const LINKEDIN_OAUTH_SCOPES = "openid profile w_member_social";

export const LINKEDIN_AUTHORIZATION_URL =
  "https://www.linkedin.com/oauth/v2/authorization";
export const LINKEDIN_ACCESS_TOKEN_URL =
  "https://www.linkedin.com/oauth/v2/accessToken";
export const LINKEDIN_USERINFO_URL = "https://api.linkedin.com/v2/userinfo";
export const LINKEDIN_POSTS_URL = "https://api.linkedin.com/rest/posts";

/** Single stored credential row for G2's personal LinkedIn member posting. */
export const LINKEDIN_PERSONAL_CREDENTIAL_ID = "g2_personal";

export function getLinkedInClientId(): string | undefined {
  return process.env.LINKEDIN_CLIENT_ID?.trim() || undefined;
}

export function getLinkedInClientSecret(): string | undefined {
  return process.env.LINKEDIN_CLIENT_SECRET?.trim() || undefined;
}

export function getLinkedInRedirectUri(): string | undefined {
  return process.env.LINKEDIN_REDIRECT_URI?.trim() || undefined;
}

export function getLinkedInStateSecret(): Buffer | undefined {
  const raw = process.env.LINKEDIN_STATE_SECRET?.trim();
  if (!raw) {
    return undefined;
  }
  const secret = Buffer.from(raw, "base64");
  if (secret.length < 32) {
    throw new Error("LINKEDIN_STATE_SECRET must decode to at least 32 bytes");
  }
  return secret;
}

export function getLinkedInTokenEncryptionKey(): Buffer | undefined {
  const raw = process.env.LINKEDIN_TOKEN_ENCRYPTION_KEY?.trim();
  if (!raw) {
    return undefined;
  }
  const key = Buffer.from(raw, "base64");
  if (key.length !== 32) {
    throw new Error("LINKEDIN_TOKEN_ENCRYPTION_KEY must decode to 32 bytes");
  }
  return key;
}

export function getLinkedInApiVersion(): string {
  return process.env.LINKEDIN_API_VERSION?.trim() || "202601";
}

export function isLinkedInOAuthConfigured(): boolean {
  try {
    return Boolean(
      getLinkedInClientId() &&
        getLinkedInClientSecret() &&
        getLinkedInRedirectUri() &&
        getLinkedInTokenEncryptionKey() &&
        getLinkedInStateSecret(),
    );
  } catch {
    return false;
  }
}
