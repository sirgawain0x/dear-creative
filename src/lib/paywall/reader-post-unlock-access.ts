import { and, eq, inArray, or } from "drizzle-orm";
import type { DearCreativeDb } from "@/db/client";
import { readerPostUnlockPurchases, unlocks } from "@/db/schema";

export async function hasReaderPostUnlockPurchase(
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
    .select({ id: readerPostUnlockPurchases.id })
    .from(readerPostUnlockPurchases)
    .where(
      and(
        eq(readerPostUnlockPurchases.postId, input.postId),
        inArray(readerPostUnlockPurchases.walletAddress, wallets),
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

export async function findPostUnlockPurchaseByTxHash(
  db: DearCreativeDb,
  txHash: string,
): Promise<{ id: string; postId: string } | null> {
  const normalized = txHash.trim().toLowerCase();
  const [row] = await db
    .select({
      id: readerPostUnlockPurchases.id,
      postId: readerPostUnlockPurchases.postId,
    })
    .from(readerPostUnlockPurchases)
    .where(
      or(
        eq(readerPostUnlockPurchases.txHash, normalized),
        eq(readerPostUnlockPurchases.txHash, txHash.trim()),
      ),
    )
    .limit(1);
  return row ?? null;
}
