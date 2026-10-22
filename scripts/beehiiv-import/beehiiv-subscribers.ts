import { parseCsvRows } from "./csv";
import { parseBeehiivUtcTimestamp } from "./dates";

export type BeehiivSubscriberPlanRow = {
  email: string;
  status: "active" | "inactive" | "pending" | "other";
  subscribedAt: Date | null;
  unsubscribedAt: Date | null;
};

export function parseBeehiivSubscriberRow(
  row: Record<string, string>,
): BeehiivSubscriberPlanRow | null {
  const rawEmail = (row.email ?? "").trim();
  if (!rawEmail) {
    return null;
  }
  const email = rawEmail.toLowerCase();
  const status = (row.status ?? "").trim().toLowerCase();
  if (status === "pending") {
    return { email, status: "pending", subscribedAt: null, unsubscribedAt: null };
  }
  if (status === "active") {
    return {
      email,
      status: "active",
      subscribedAt: parseBeehiivUtcTimestamp(row.created_at ?? ""),
      unsubscribedAt: null,
    };
  }
  if (status === "inactive") {
    return {
      email,
      status: "inactive",
      subscribedAt: parseBeehiivUtcTimestamp(row.created_at ?? ""),
      unsubscribedAt: parseBeehiivUtcTimestamp(row.unsubscribed_at ?? ""),
    };
  }
  return { email, status: "other", subscribedAt: null, unsubscribedAt: null };
}

export function countBeehiivSubscriberStatuses(content: string): {
  total: number;
  active: number;
  inactive: number;
  pending: number;
  other: number;
} {
  const { rows } = parseCsvRows(content);
  let active = 0;
  let inactive = 0;
  let pending = 0;
  let other = 0;

  for (const row of rows) {
    const parsed = parseBeehiivSubscriberRow(row);
    if (!parsed) {
      other += 1;
      continue;
    }
    if (parsed.status === "active") active += 1;
    else if (parsed.status === "inactive") inactive += 1;
    else if (parsed.status === "pending") pending += 1;
    else other += 1;
  }

  return { total: rows.length, active, inactive, pending, other };
}
