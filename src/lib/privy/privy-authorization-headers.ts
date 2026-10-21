export type PrivyAuthorizationSession = {
  privyConfigured: boolean;
  authenticated: boolean;
  getAccessToken: () => Promise<string | null>;
};

/** Privy access token only — no studio/Adam localStorage fallback. */
export async function privyAuthorizationHeaders(
  session: PrivyAuthorizationSession,
): Promise<{ Authorization: string } | null> {
  if (!session.privyConfigured || !session.authenticated) {
    return null;
  }
  try {
    const token = await session.getAccessToken();
    const trimmed = token?.trim();
    if (!trimmed) {
      return null;
    }
    return { Authorization: `Bearer ${trimmed}` };
  } catch {
    return null;
  }
}
