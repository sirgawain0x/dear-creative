import { randomUUID } from "node:crypto";
import { and, eq } from "drizzle-orm";
import type { DearCreativeDb } from "@/db/client";
import { posts, readerPostUnlockPurchases, writers } from "@/db/schema";
import { parseValidTipPayToAddress } from "@/lib/posts/post-tip-payee";
import { publishedVisibilityFilter } from "@/lib/posts/published-posts";
import {
  BASE_CHAIN_ID,
  BASE_USDC_ADDRESS,
} from "@/lib/payments/subscription-config";
import { ReaderCheckoutError } from "./reader-checkout-errors";
import { findPostUnlockPurchaseByTxHash } from "./reader-post-unlock-access";
import {
  normalizeReaderCheckoutTxHash,
  verifyReaderCheckoutTransfer,
} from "./reader-checkout-receipt";
import { isSqliteUniqueConstraintError } from "@/lib/db/sqlite-errors";
import { postUnlockAmountRaw } from "./unlock-config";
import { writerHasGatedPosts } from "./writer-gated-posts";

export type ReaderPostUnlockContext = {
  postSlug: string;
  postId: string;
  writerId: string | null;
  payToSplitAddress: string | null;
  unlockPriceUsdc: number;
  unlockAmountRaw: string;
  /** Unlock Protocol subscription offer (docs-only phase; no checkout yet). */
  showUnlockProtocolSubscribeOffer: boolean;
  chainId: number;
  tokenAddress: string;
};

export async function loadReaderPostUnlockContext(
  db: DearCreativeDb,
  slug: string,
): Promise<ReaderPostUnlockContext | null> {
  const [row] = await db
    .select({
      postId: posts.id,
      authorId: posts.authorId,
      isGated: posts.isGated,
      payoutSplitAddress: writers.payoutSplitAddress,
    })
    .from(posts)
    .leftJoin(writers, eq(posts.authorId, writers.id))
    .where(and(publishedVisibilityFilter(), eq(posts.slug, slug)))
    .limit(1);

  if (!row || !row.isGated) {
    return null;
  }

  const writerId = row.authorId?.trim() ?? null;
  const payTo = parseValidTipPayToAddress(row.payoutSplitAddress);
  const unlockRaw = postUnlockAmountRaw();
  const showUnlockProtocolSubscribeOffer = writerId
    ? await writerHasGatedPosts(db, writerId)
    : false;

  const unlockUnits = Number(unlockRaw) / 1_000_000;

  return {
    postSlug: slug,
    postId: row.postId,
    writerId,
    payToSplitAddress: payTo,
    unlockPriceUsdc: unlockUnits,
    unlockAmountRaw: unlockRaw.toString(),
    showUnlockProtocolSubscribeOffer,
    chainId: BASE_CHAIN_ID,
    tokenAddress: BASE_USDC_ADDRESS,
  };
}

function assertWriterSplitConfigured(
  split: string | null,
): asserts split is string {
  if (!split) {
    throw new ReaderCheckoutError(
      "writer_not_configured",
      "Writer payout is not configured.",
      503,
    );
  }
}

export async function verifyAndRecordPostUnlock(
  db: DearCreativeDb,
  input: {
    slug: string;
    txHash: string;
    walletAddress: string;
    privyUserId: string;
  },
): Promise<{ recordId: string; idempotent: boolean }> {
  const amountRaw = postUnlockAmountRaw();

  const context = await loadReaderPostUnlockContext(db, input.slug);
  if (!context) {
    throw new ReaderCheckoutError(
      "post_not_found",
      "Post not found.",
      404,
    );
  }
  assertWriterSplitConfigured(context.payToSplitAddress);
  if (!context.writerId) {
    throw new ReaderCheckoutError(
      "writer_not_configured",
      "Writer payout is not configured.",
      503,
    );
  }

  const txHash = normalizeReaderCheckoutTxHash(input.txHash);
  const existing = await findPostUnlockPurchaseByTxHash(db, txHash);
  if (existing) {
    if (existing.postId !== context.postId) {
      throw new ReaderCheckoutError(
        "tx_hash_reused",
        "This transaction was already used.",
        409,
      );
    }
    const walletMatch =
      existing.walletAddress.toLowerCase() ===
      input.walletAddress.toLowerCase();
    const privyMatch = existing.privyUserId === input.privyUserId;
    if (!walletMatch || !privyMatch) {
      throw new ReaderCheckoutError(
        "tx_hash_reused",
        "This transaction was already used.",
        409,
      );
    }
    return { recordId: existing.id, idempotent: true };
  }

  await verifyReaderCheckoutTransfer({
    txHash,
    expectedRecipient: context.payToSplitAddress as `0x${string}`,
    expectedAmountRaw: amountRaw,
    payerAddress: input.walletAddress.toLowerCase() as `0x${string}`,
    chainId: BASE_CHAIN_ID,
  });

  const recordId = randomUUID();
  try {
    await db.insert(readerPostUnlockPurchases).values({
      id: recordId,
      privyUserId: input.privyUserId,
      walletAddress: input.walletAddress.toLowerCase(),
      writerId: context.writerId,
      postId: context.postId,
      txHash,
      chainId: BASE_CHAIN_ID,
      tokenAddress: BASE_USDC_ADDRESS.toLowerCase(),
      amountRaw: amountRaw.toString(),
    });
  } catch (error) {
    if (!isSqliteUniqueConstraintError(error)) {
      throw error;
    }
    const raced = await findPostUnlockPurchaseByTxHash(db, txHash);
    if (!raced) {
      throw error;
    }
    if (raced.postId !== context.postId) {
      throw new ReaderCheckoutError(
        "tx_hash_reused",
        "This transaction was already used.",
        409,
      );
    }
    const walletMatch =
      raced.walletAddress.toLowerCase() === input.walletAddress.toLowerCase();
    const privyMatch = raced.privyUserId === input.privyUserId;
    if (!walletMatch || !privyMatch) {
      throw new ReaderCheckoutError(
        "tx_hash_reused",
        "This transaction was already used.",
        409,
      );
    }
    return { recordId: raced.id, idempotent: true };
  }

  return { recordId, idempotent: false };
}

/** @deprecated Use loadReaderPostUnlockContext */
export const loadReaderCheckoutContext = loadReaderPostUnlockContext;
