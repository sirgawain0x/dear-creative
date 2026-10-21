import { and, count, eq, gt } from "drizzle-orm";
import type { DearCreativeDb } from "@/db/client";
import { subscribers, subscriptions } from "@/db/schema";

export const ACTIVE_SUBSCRIBER_COUNT_ERROR_CODE =
  "active_subscriber_count_failed" as const;

/** Confirmed email list members (double opt-in complete, not unsubscribed). */
export async function countConfirmedEmailSubscribers(
  db: DearCreativeDb,
): Promise<number> {
  const [row] = await db
    .select({ count: count() })
    .from(subscribers)
    .where(eq(subscribers.status, "subscribed"));
  return row?.count ?? 0;
}

/** Paid newsletter subscriptions with an unexpired active period. */
export async function countActivePaidSubscriptions(
  db: DearCreativeDb,
  asOf: Date = new Date(),
): Promise<number> {
  const [row] = await db
    .select({ count: count() })
    .from(subscriptions)
    .where(
      and(
        eq(subscriptions.status, "active"),
        gt(subscriptions.periodEnd, asOf),
      ),
    );
  return row?.count ?? 0;
}

export async function queryActiveSubscriberCount(
  db: DearCreativeDb,
  asOf: Date = new Date(),
): Promise<number> {
  const [freeCount, paidCount] = await Promise.all([
    countConfirmedEmailSubscribers(db),
    countActivePaidSubscriptions(db, asOf),
  ]);
  return freeCount + paidCount;
}

export function formatActiveSubscriberCount(count: number): string {
  return count.toLocaleString("en-US");
}
