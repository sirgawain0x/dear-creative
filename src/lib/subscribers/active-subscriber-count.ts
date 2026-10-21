import { sql } from "drizzle-orm";
import type { DearCreativeDb } from "@/db/client";
import { subscribers, subscriptions } from "@/db/schema";

export const ACTIVE_SUBSCRIBER_COUNT_ERROR_CODE =
  "active_subscriber_count_failed" as const;

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
      )
    )
  `);
  const row = rows[0];
  return Number(row?.count ?? 0);
}

export function formatActiveSubscriberCount(count: number): string {
  return count.toLocaleString("en-US");
}
