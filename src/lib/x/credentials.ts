export type XOAuth2Credentials = {
  clientId: string;
  clientSecret: string;
  refreshToken: string;
};

let missingCredentialsLogged = false;

export function resetXCredentialsLogForTests(): void {
  missingCredentialsLogged = false;
}

export function readXOAuth2Credentials(): XOAuth2Credentials | null {
  const clientId = process.env.X_CLIENT_ID?.trim();
  const clientSecret = process.env.X_CLIENT_SECRET?.trim();
  const refreshToken = process.env.X_REFRESH_TOKEN?.trim();

  const missing: string[] = [];
  if (!clientId) {
    missing.push("X_CLIENT_ID");
  }
  if (!clientSecret) {
    missing.push("X_CLIENT_SECRET");
  }
  if (!refreshToken) {
    missing.push("X_REFRESH_TOKEN");
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
    clientId: clientId!,
    clientSecret: clientSecret!,
    refreshToken: refreshToken!,
  };
}
