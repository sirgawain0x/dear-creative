import { sql } from "drizzle-orm";
import type { DearCreativeDb } from "@/db/client";
import { subscribers, subscriptions } from "@/db/schema";

export const ACTIVE_SUBSCRIBER_COUNT_ERROR_CODE =
  "active_subscriber_count_failed" as const;

/**
 * Cross-channel dedupe when the same person appears on the free list and as a
 * paid subscriber. There is no privy_user_id (or other Privy→email) column on
 * `subscribers`; the only join key in schema is normalized email = subscription
 * wallet (case-insensitive).
 */
export const ACTIVE_SUBSCRIBER_IDENTITY_LINK =
  "LOWER(TRIM(subscribers.email)) = LOWER(TRIM(subscriptions.wallet))" as const;

export async function queryActiveSubscriberCount(
  db: DearCreativeDb,
  asOf: Date = new Date(),
): Promise<number> {
  const asOfMs = asOf.getTime();
  const rows = await db.all<{ count: number }>(sql`
    SELECT COUNT(*) AS count
    FROM (
      SELECT person_key
      FROM (
        SELECT LOWER(TRIM(${subscribers.email})) AS person_key
        FROM ${subscribers}
        WHERE ${subscribers.status} = 'subscribed'
        UNION
        SELECT ${subscriptions.privyUserId} AS person_key
        FROM ${subscriptions}
        WHERE ${subscriptions.status} = 'active'
          AND ${subscriptions.periodEnd} > ${asOfMs}
          AND NOT EXISTS (
            SELECT 1
            FROM ${subscribers} AS linked
            WHERE linked.status = 'subscribed'
              AND LOWER(TRIM(linked.email)) = LOWER(TRIM(${subscriptions.wallet}))
          )
      )
    )
  `);
  const row = rows[0];
  return Number(row?.count ?? 0);
}

export function formatActiveSubscriberCount(count: number): string {
  return count.toLocaleString("en-US");
}
