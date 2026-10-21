export type XOAuth1UserCredentials = {
  apiKey: string;
  apiSecret: string;
  accessToken: string;
  accessTokenSecret: string;
};

let missingCredentialsLogged = false;

export function resetXCredentialsLogForTests(): void {
  missingCredentialsLogged = false;
}

function readAccessTokenSecret(): string | undefined {
  const primary = process.env.X_ACCESS_TOKEN_SECRET?.trim();
  if (primary) {
    return primary;
  }
  return process.env.X_ACCESS_SECRET?.trim();
}

export function readXOAuth1UserCredentials(): XOAuth1UserCredentials | null {
  const apiKey = process.env.X_API_KEY?.trim();
  const apiSecret = process.env.X_API_SECRET?.trim();
  const accessToken = process.env.X_ACCESS_TOKEN?.trim();
  const accessTokenSecret = readAccessTokenSecret();

  const missing: string[] = [];
  if (!apiKey) {
    missing.push("X_API_KEY");
  }
  if (!apiSecret) {
    missing.push("X_API_SECRET");
  }
  if (!accessToken) {
    missing.push("X_ACCESS_TOKEN");
  }
  if (!accessTokenSecret) {
    missing.push("X_ACCESS_TOKEN_SECRET (or legacy X_ACCESS_SECRET)");
  }

  if (missing.length > 0) {
    if (!missingCredentialsLogged) {
      missingCredentialsLogged = true;
      console.warn(
        `[x-client] X API client unavailable: missing env ${missing.join(", ")}`,
      );
    }
    return null;
  }

  return {
    apiKey: apiKey!,
    apiSecret: apiSecret!,
    accessToken: accessToken!,
    accessTokenSecret: accessTokenSecret!,
  };
}
