import { resolveStudioBearerToken } from "./studio-bearer-token";

export type AdminApiAuthSession = {
  privyConfigured: boolean;
  authenticated: boolean;
  getAccessToken: () => Promise<string | null>;
};

/** Same bearer resolution as Metrics and Payouts admin cards. */
export async function resolveAdminApiBearerToken(
  session: AdminApiAuthSession,
): Promise<string | null> {
  return resolveStudioBearerToken({
    privyConfigured: session.privyConfigured,
    authenticated: session.authenticated,
    getAccessToken: session.getAccessToken,
  });
}

export async function adminApiAuthorizationHeaders(
  session: AdminApiAuthSession,
): Promise<{ Authorization: string } | null> {
  const token = await resolveAdminApiBearerToken(session);
  if (!token) {
    return null;
  }
  return { Authorization: `Bearer ${token}` };
}

/** Privy access token only — no studio/Adam localStorage fallback (Funds API). */
export async function adminPrivyAuthorizationHeaders(
  session: AdminApiAuthSession,
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
