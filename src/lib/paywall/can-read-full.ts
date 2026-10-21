import { and, eq, gt, inArray } from "drizzle-orm";
import type { DearCreativeDb } from "@/db/client";
import { subscriptions, unlocks } from "@/db/schema";
import type { PostViewer } from "./viewer-types";

export type PaywallPostAccessInput = {
  isGated: boolean;
  authorId: string | null;
  postId: string;
};

export async function resolveSubscriptionAccess(
  db: DearCreativeDb,
  input: {
    privyUserId: string;
    writerId: string | null;
    asOf?: Date;
  },
): Promise<boolean> {
  const writerId = input.writerId?.trim();
  if (!writerId) {
    return false;
  }
  const asOf = input.asOf ?? new Date();
  const [row] = await db
    .select({ id: subscriptions.id })
    .from(subscriptions)
    .where(
      and(
        eq(subscriptions.privyUserId, input.privyUserId),
        eq(subscriptions.writerId, writerId),
        eq(subscriptions.status, "active"),
        gt(subscriptions.periodEnd, asOf),
      ),
    )
    .limit(1);
  return Boolean(row);
}

export async function resolveUnlockAccess(
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

/**
 * Whether the viewer may read gated_content for this post.
 * Includes single-post pay-per-post unlock rows on `unlocks`.
 */
export async function canReadFull(
  db: DearCreativeDb,
  post: PaywallPostAccessInput,
  viewer: PostViewer | null,
  options?: { asOf?: Date },
): Promise<boolean> {
  if (!post.isGated) {
    return true;
  }
  if (!viewer) {
    return false;
  }
  if (viewer.isAdmin) {
    return true;
  }
  if (post.authorId && viewer.writerId && post.authorId === viewer.writerId) {
    return true;
  }

  const writerId = post.authorId?.trim() ?? null;
  const [hasSubscription, hasUnlock] = await Promise.all([
    resolveSubscriptionAccess(db, {
      privyUserId: viewer.privyUserId,
      writerId,
      asOf: options?.asOf,
    }),
    resolveUnlockAccess(db, {
      postId: post.postId,
      walletAddresses: viewer.linkedWalletAddresses,
    }),
  ]);
  return hasSubscription || hasUnlock;
}

/** @deprecated Use canReadFull */
export async function resolveCanReadFullPost(
  db: DearCreativeDb,
  post: PaywallPostAccessInput,
  viewer: PostViewer | null,
  options?: { asOf?: Date },
): Promise<boolean> {
  return canReadFull(db, post, viewer, options);
}
