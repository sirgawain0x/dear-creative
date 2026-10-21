import { and, eq, isNotNull } from "drizzle-orm";
import { getAddress, zeroAddress, type Address } from "viem";
import type { DearCreativeDb } from "@/db/client";
import { posts, writers } from "@/db/schema";

const publishedFilter = and(
  eq(posts.status, "published"),
  isNotNull(posts.publishedAt),
);

/** Validates a tip recipient: checksummed EVM address, not the zero address. */
export function parseValidTipPayToAddress(
  raw: string | null | undefined,
): Address | null {
  if (typeof raw !== "string" || raw.trim().length === 0) {
    return null;
  }
  try {
    const normalized = getAddress(raw.trim());
    if (normalized === zeroAddress) {
      return null;
    }
    return normalized;
  } catch {
    return null;
  }
}

/**
 * Resolves the writer Split for tips on a published post:
 * `posts.author_id` → `writers.id` → `writers.payout_split_address`.
 * Returns null when author_id is unset, the writer row is missing, or the split is invalid.
 */
export async function resolvePostTipPayToAddress(
  db: DearCreativeDb,
  slug: string,
): Promise<Address | null> {
  const [row] = await db
    .select({
      payoutSplitAddress: writers.payoutSplitAddress,
    })
    .from(posts)
    .leftJoin(writers, eq(posts.authorId, writers.id))
    .where(and(publishedFilter, eq(posts.slug, slug)))
    .limit(1);

  if (!row) {
    return null;
  }

  return parseValidTipPayToAddress(row.payoutSplitAddress);
}

export function shouldRenderPostTipCard(
  payToAddress: Address | null,
): payToAddress is Address {
  return payToAddress !== null;
}
