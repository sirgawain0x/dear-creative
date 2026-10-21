import { findWriterByPayoutWalletMatch } from "@/lib/admin/admin-payouts";
import type { DearCreativeDb } from "@/db/client";
import { listChecksumLinkedWalletAddresses } from "@/lib/payments/privy-linked-wallet";
import { getPrivyServerClient } from "@/lib/privy/server-client";
import {
  getPrivyUserIdFromCookies,
  isPrivyAdminUserId,
  PRIVY_ACCESS_TOKEN_COOKIE,
  type CookieReader,
} from "@/lib/privy/session-from-cookies";
import type { PostViewer } from "./viewer-types";

async function linkedWalletsForPrivyUser(
  privyUserId: string,
  accessToken: string | undefined,
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
      // fall through
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

export async function resolvePostViewerFromCookies(
  db: DearCreativeDb,
  readCookie: CookieReader,
): Promise<PostViewer | null> {
  const privyUserId = await getPrivyUserIdFromCookies(readCookie);
  if (!privyUserId) {
    return null;
  }

  const linkedWalletAddresses = await linkedWalletsForPrivyUser(
    privyUserId,
    readCookie(PRIVY_ACCESS_TOKEN_COOKIE),
  );

  const writer = await findWriterByPayoutWalletMatch(db, linkedWalletAddresses);

  return {
    privyUserId,
    linkedWalletAddresses,
    isAdmin: isPrivyAdminUserId(privyUserId),
    writerId: writer?.id ?? null,
  };
}
