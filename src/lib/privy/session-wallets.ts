import { listChecksumLinkedWalletAddresses } from "@/lib/payments/privy-linked-wallet";
import { getPrivyServerClient } from "./server-client";
import {
  getPrivyUserIdFromCookies,
  PRIVY_ACCESS_TOKEN_COOKIE,
  type CookieReader,
} from "./session-from-cookies";

/**
 * A signed-in Privy session plus every wallet linked to that account.
 * Wallet addresses are the unit of membership: the Creator Pass lives on a
 * wallet, and future per-member studios will be keyed by it too.
 */
export type PrivySessionWithWallets = {
  privyUserId: string;
  linkedWalletAddresses: string[];
};

/**
 * Privy user → checksummed linked wallets. Prefers the access token so we know
 * the cookie belongs to this user, then falls back to a server-side lookup.
 */
export async function resolvePrivyLinkedWalletAddresses(
  privyUserId: string,
  accessToken?: string,
): Promise<string[]> {
  const client = getPrivyServerClient();
  if (!client) {
    return [];
  }

  if (accessToken) {
    try {
      const claims = await client.verifyAuthToken(accessToken);
      if (claims.userId === privyUserId) {
        const user = await client.getUserById(claims.userId);
        if (user) {
          return listChecksumLinkedWalletAddresses(user);
        }
      }
    } catch {
      // fall through to the id-based lookup
    }
  }

  try {
    const user = await client.getUserById(privyUserId);
    if (user) {
      return listChecksumLinkedWalletAddresses(user);
    }
  } catch {
    return [];
  }

  return [];
}

/** Cookies → Privy session with linked wallets, or null when signed out. */
export async function resolvePrivySessionWithWallets(
  readCookie: CookieReader,
): Promise<PrivySessionWithWallets | null> {
  const privyUserId = await getPrivyUserIdFromCookies(readCookie);
  if (!privyUserId) {
    return null;
  }

  const linkedWalletAddresses = await resolvePrivyLinkedWalletAddresses(
    privyUserId,
    readCookie(PRIVY_ACCESS_TOKEN_COOKIE),
  );

  return { privyUserId, linkedWalletAddresses };
}
