import { and, eq, gt, inArray, or } from "drizzle-orm";
import type { DearCreativeDb } from "@/db/client";
import { readerCheckoutRecords, unlocks } from "@/db/schema";

export async function hasReaderCheckoutUnlock(
  db: DearCreativeDb,
  input: { postId: string; walletAddresses: string[] },
): Promise<boolean> {
  const wallets = input.walletAddresses
    .map((address) => address.trim().toLowerCase())
    .filter(Boolean);
  if (wallets.length === 0) {
    return false;
  }

  const [row] = await db
    .select({ id: readerCheckoutRecords.id })
    .from(readerCheckoutRecords)
    .where(
      and(
        eq(readerCheckoutRecords.kind, "post_unlock"),
        eq(readerCheckoutRecords.postId, input.postId),
        inArray(readerCheckoutRecords.walletAddress, wallets),
      ),
    )
    .limit(1);
  return Boolean(row);
}

export async function hasLegacyUnlock(
  db: DearCreativeDb,
  input: { postId: string; walletAddresses: string[] },
): Promise<boolean> {
  const wallets = input.walletAddresses
    .map((address) => address.trim().toLowerCase())
    .filter(Boolean);
  if (wallets.length === 0) {
    return false;
  }
  const [row] = await db
    .select({ id: unlocks.id })
    .from(unlocks)
    .where(
      and(
        eq(unlocks.postId, input.postId),
        inArray(unlocks.walletAddress, wallets),
      ),
    )
    .limit(1);
  return Boolean(row);
}

export async function resolveReaderCheckoutSubscription(
  db: DearCreativeDb,
  input: {
    privyUserId: string;
    writerId: string | null;
    asOf?: Date;
  },
): Promise<{ periodEnd: Date } | null> {
  const writerId = input.writerId?.trim();
  if (!writerId) {
    return null;
  }
  const asOf = input.asOf ?? new Date();
  const [row] = await db
    .select({ periodEnd: readerCheckoutRecords.periodEnd })
    .from(readerCheckoutRecords)
    .where(
      and(
        eq(readerCheckoutRecords.kind, "subscription"),
        eq(readerCheckoutRecords.privyUserId, input.privyUserId),
        eq(readerCheckoutRecords.writerId, writerId),
        gt(readerCheckoutRecords.periodEnd, asOf),
      ),
    )
    .limit(1);
  if (!row?.periodEnd) {
    return null;
  }
  return { periodEnd: row.periodEnd };
}

export async function findReaderCheckoutByTxHash(
  db: DearCreativeDb,
  txHash: string,
): Promise<{ id: string; kind: string; postId: string | null } | null> {
  const normalized = txHash.trim().toLowerCase();
  const [row] = await db
    .select({
      id: readerCheckoutRecords.id,
      kind: readerCheckoutRecords.kind,
      postId: readerCheckoutRecords.postId,
    })
    .from(readerCheckoutRecords)
    .where(
      or(
        eq(readerCheckoutRecords.txHash, normalized),
        eq(readerCheckoutRecords.txHash, txHash.trim()),
      ),
    )
    .limit(1);
  return row ?? null;
}
