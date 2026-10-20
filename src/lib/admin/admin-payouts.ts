import type { LibSQLDatabase } from "drizzle-orm/libsql";
import type * as schema from "@/db/schema";
import { writers } from "@/db/schema";
import { dearPlatformTreasuryAddress } from "@/lib/payments/subscription-config";
import { formatChecksumAddress } from "@/lib/admin/payout-address";

export type AdminPayoutsSnapshot = {
  payoutWalletAddress: string | null;
  payoutSplitAddress: string | null;
  treasuryAddress: string | null;
};

type Db = LibSQLDatabase<typeof schema>;
type WriterRow = typeof writers.$inferSelect;

export type AdminPayoutsLoadOptions = {
  /** Checksummed linked wallets for the signed-in Privy admin; null for Adam token (no Privy user). */
  privyLinkedWalletAddresses: string[] | null;
};

export async function findWriterByPayoutWalletMatch(
  db: Db,
  privyLinkedWalletAddresses: string[],
): Promise<WriterRow | null> {
  if (privyLinkedWalletAddresses.length === 0) {
    return null;
  }

  const linkedLower = new Set(
    privyLinkedWalletAddresses.map((address) => address.toLowerCase()),
  );
  const rows = await db.select().from(writers);

  for (const row of rows) {
    const payout = formatChecksumAddress(row.payoutWalletAddress);
    if (payout && linkedLower.has(payout.toLowerCase())) {
      return row;
    }
  }

  return null;
}

export async function loadAdminPayoutsSnapshot(
  db: Db,
  options: AdminPayoutsLoadOptions,
): Promise<AdminPayoutsSnapshot> {
  const treasury = dearPlatformTreasuryAddress();
  let writer: WriterRow | null = null;

  if (options.privyLinkedWalletAddresses !== null) {
    writer = await findWriterByPayoutWalletMatch(
      db,
      options.privyLinkedWalletAddresses,
    );
  }

  return {
    payoutWalletAddress: formatChecksumAddress(writer?.payoutWalletAddress),
    payoutSplitAddress: formatChecksumAddress(writer?.payoutSplitAddress),
    treasuryAddress: treasury ? formatChecksumAddress(treasury) : null,
  };
}
