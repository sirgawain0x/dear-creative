import { randomUUID } from "node:crypto";
import { and, desc, eq, isNotNull } from "drizzle-orm";
import type { DearCreativeDb } from "@/db/client";
import {
  posts,
  readerCheckoutRecords,
  writers,
  type SubscriptionPlan,
} from "@/db/schema";
import { parseValidTipPayToAddress } from "@/lib/posts/post-tip-payee";
import { publishedVisibilityFilter } from "@/lib/posts/published-posts";
import {
  BASE_CHAIN_ID,
  BASE_USDC_ADDRESS,
  readerSubscriptionAmountRaw,
  readerSubscriptionPeriodMs,
} from "./reader-checkout-config";
import { ReaderCheckoutError } from "./reader-checkout-errors";
import { findReaderCheckoutByTxHash } from "./reader-checkout-access";
import {
  normalizeReaderCheckoutTxHash,
  verifyReaderCheckoutTransfer,
} from "./reader-checkout-receipt";
import { postUnlockAmountRaw } from "./unlock-config";
import { writerHasGatedPosts } from "./writer-gated-posts";

export type ReaderCheckoutContext = {
  postSlug: string;
  postId: string;
  writerId: string | null;
  payToSplitAddress: string | null;
  unlockPriceUsdc: number | null;
  unlockAmountRaw: string | null;
  showSubscribe: boolean;
  subscriptionPlans: Array<{
    plan: SubscriptionPlan;
    priceUsdc: number;
    amountRaw: string;
    periodDays: number;
  }>;
  chainId: number;
  tokenAddress: string;
};

export async function loadReaderCheckoutContext(
  db: DearCreativeDb,
  slug: string,
): Promise<ReaderCheckoutContext | null> {
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
  const showSubscribe = writerId
    ? await writerHasGatedPosts(db, writerId)
    : false;

  const subscriptionPlans: ReaderCheckoutContext["subscriptionPlans"] = [];
  if (showSubscribe && payTo) {
    for (const plan of ["monthly", "yearly"] as const) {
      const amount = readerSubscriptionAmountRaw(plan);
      subscriptionPlans.push({
        plan,
        priceUsdc: plan === "monthly" ? 8 : 80,
        amountRaw: amount.toString(),
        periodDays: plan === "monthly" ? 30 : 365,
      });
    }
  }

  const unlockUnits = unlockRaw
    ? Number(unlockRaw) / 1_000_000
    : null;

  return {
    postSlug: slug,
    postId: row.postId,
    writerId,
    payToSplitAddress: payTo,
    unlockPriceUsdc: unlockUnits,
    unlockAmountRaw: unlockRaw?.toString() ?? null,
    showSubscribe,
    subscriptionPlans,
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
    nowMs?: number;
  },
): Promise<{ recordId: string; idempotent: boolean }> {
  const amountRaw = postUnlockAmountRaw();
  if (amountRaw === null) {
    throw new ReaderCheckoutError(
      "unlock_unavailable",
      "Post unlock is not available.",
      503,
    );
  }

  const context = await loadReaderCheckoutContext(db, input.slug);
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
  const existing = await findReaderCheckoutByTxHash(db, txHash);
  if (existing) {
    if (existing.kind !== "post_unlock" || existing.postId !== context.postId) {
      throw new ReaderCheckoutError(
        "tx_hash_reused",
        "This transaction was already used.",
        402,
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
  await db.insert(readerCheckoutRecords).values({
    id: recordId,
    kind: "post_unlock",
    privyUserId: input.privyUserId,
    walletAddress: input.walletAddress.toLowerCase(),
    writerId: context.writerId,
    postId: context.postId,
    plan: null,
    txHash,
    chainId: BASE_CHAIN_ID,
    tokenAddress: BASE_USDC_ADDRESS.toLowerCase(),
    amountRaw: amountRaw.toString(),
    periodStart: null,
    periodEnd: null,
  });

  return { recordId, idempotent: false };
}

export async function verifyAndRecordSubscription(
  db: DearCreativeDb,
  input: {
    writerId: string;
    plan: SubscriptionPlan;
    txHash: string;
    walletAddress: string;
    privyUserId: string;
    nowMs?: number;
  },
): Promise<{ recordId: string; periodEnd: string; idempotent: boolean }> {
  const writerId = input.writerId.trim();
  if (!writerId) {
    throw new ReaderCheckoutError(
      "invalid_body",
      "Request body is invalid.",
      400,
    );
  }

  const hasGated = await writerHasGatedPosts(db, writerId);
  if (!hasGated) {
    throw new ReaderCheckoutError(
      "subscription_unavailable",
      "Subscription is not available for this writer.",
      404,
    );
  }

  const [writerRow] = await db
    .select({ payoutSplitAddress: writers.payoutSplitAddress })
    .from(writers)
    .where(eq(writers.id, writerId))
    .limit(1);

  const split = parseValidTipPayToAddress(writerRow?.payoutSplitAddress);
  assertWriterSplitConfigured(split);

  const amountRaw = readerSubscriptionAmountRaw(input.plan);
  const txHash = normalizeReaderCheckoutTxHash(input.txHash);
  const existing = await findReaderCheckoutByTxHash(db, txHash);
  if (existing) {
    if (existing.kind !== "subscription") {
      throw new ReaderCheckoutError(
        "tx_hash_reused",
        "This transaction was already used.",
        402,
      );
    }
    const [subRow] = await db
      .select({ periodEnd: readerCheckoutRecords.periodEnd })
      .from(readerCheckoutRecords)
      .where(eq(readerCheckoutRecords.id, existing.id))
      .limit(1);
    return {
      recordId: existing.id,
      periodEnd: subRow?.periodEnd?.toISOString() ?? new Date(0).toISOString(),
      idempotent: true,
    };
  }

  await verifyReaderCheckoutTransfer({
    txHash,
    expectedRecipient: split,
    expectedAmountRaw: amountRaw,
    payerAddress: input.walletAddress.toLowerCase() as `0x${string}`,
    chainId: BASE_CHAIN_ID,
  });

  const nowMs = input.nowMs ?? Date.now();
  const periodStart = new Date(nowMs);
  const periodEnd = new Date(nowMs + readerSubscriptionPeriodMs(input.plan));
  const recordId = randomUUID();

  await db.insert(readerCheckoutRecords).values({
    id: recordId,
    kind: "subscription",
    privyUserId: input.privyUserId,
    walletAddress: input.walletAddress.toLowerCase(),
    writerId,
    postId: null,
    plan: input.plan,
    txHash,
    chainId: BASE_CHAIN_ID,
    tokenAddress: BASE_USDC_ADDRESS.toLowerCase(),
    amountRaw: amountRaw.toString(),
    periodStart,
    periodEnd,
  });

  return {
    recordId,
    periodEnd: periodEnd.toISOString(),
    idempotent: false,
  };
}

export async function loadActiveReaderSubscriptionSummary(
  db: DearCreativeDb,
  input: { privyUserId: string; writerId: string | null; asOf?: Date },
): Promise<{
  periodEnd: string;
  showRenewPrompt: boolean;
  expired: boolean;
} | null> {
  const writerId = input.writerId?.trim();
  if (!writerId) {
    return null;
  }
  const asOf = input.asOf ?? new Date();
  const [latest] = await db
    .select({
      periodEnd: readerCheckoutRecords.periodEnd,
    })
    .from(readerCheckoutRecords)
    .where(
      and(
        eq(readerCheckoutRecords.kind, "subscription"),
        eq(readerCheckoutRecords.privyUserId, input.privyUserId),
        eq(readerCheckoutRecords.writerId, writerId),
        isNotNull(readerCheckoutRecords.periodEnd),
      ),
    )
    .orderBy(desc(readerCheckoutRecords.periodEnd))
    .limit(1);

  if (!latest?.periodEnd) {
    return null;
  }

  const periodEnd = latest.periodEnd;
  const expired = periodEnd.getTime() <= asOf.getTime();
  const renewWindowMs = 7 * 24 * 60 * 60 * 1000;
  const showRenewPrompt =
    expired ||
    periodEnd.getTime() - asOf.getTime() <= renewWindowMs;

  return {
    periodEnd: periodEnd.toISOString(),
    showRenewPrompt,
    expired,
  };
}
