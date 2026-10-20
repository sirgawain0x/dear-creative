import type { LibSQLDatabase } from "drizzle-orm/libsql";
import * as schema from "@/db/schema";
import { dearPlatformTreasuryAddress } from "@/lib/payments/subscription-config";
import { formatChecksumAddress } from "@/lib/admin/payout-address";
import { getOwnerWriter } from "@/lib/admin/owner-writer";

export type AdminPayoutsSnapshot = {
  payoutWalletAddress: string | null;
  payoutSplitAddress: string | null;
  treasuryAddress: string | null;
};

type Db = LibSQLDatabase<typeof schema>;

export async function loadAdminPayoutsSnapshot(
  db: Db,
): Promise<AdminPayoutsSnapshot> {
  const writer = await getOwnerWriter(db);
  const treasury = dearPlatformTreasuryAddress();

  return {
    payoutWalletAddress: formatChecksumAddress(writer?.payoutWalletAddress),
    payoutSplitAddress: formatChecksumAddress(writer?.payoutSplitAddress),
    treasuryAddress: treasury ? formatChecksumAddress(treasury) : null,
  };
}
