import { findWriterByPayoutWalletMatch } from "@/lib/admin/admin-payouts";
import type { DearCreativeDb } from "@/db/client";
import { isPrivyAdminUserId } from "@/lib/privy/session-from-cookies";
import { resolvePrivySessionWithWallets } from "@/lib/privy/session-wallets";
import type { PostViewer } from "./viewer-types";

export async function resolvePostViewerFromCookies(
  db: DearCreativeDb,
  readCookie: (name: string) => string | undefined,
): Promise<PostViewer | null> {
  const session = await resolvePrivySessionWithWallets(readCookie);
  if (!session) {
    return null;
  }

  const writer = await findWriterByPayoutWalletMatch(
    db,
    session.linkedWalletAddresses,
  );

  return {
    privyUserId: session.privyUserId,
    linkedWalletAddresses: session.linkedWalletAddresses,
    isAdmin: isPrivyAdminUserId(session.privyUserId),
    writerId: writer?.id ?? null,
  };
}
