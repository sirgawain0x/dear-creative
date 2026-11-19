import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import { createClient, type Client } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import { migrate } from "drizzle-orm/libsql/migrator";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { DearCreativeDb } from "@/db/client";
import * as schema from "@/db/schema";
import { approvals, deliveryReceipts, posts } from "@/db/schema";
import { DEFAULT_DELIVERY_PENDING_STALE_MS } from "./delivery-receipt-constants";
import { listApprovalQueue } from "./list-queue";

async function seedPostWithEmailReceipt(
  db: DearCreativeDb,
  options: {
    slug: string;
    receiptStatus?: "pending" | "completed" | "failed" | "needs_review";
    updatedAt?: Date;
    completedAt?: Date;
    lastError?: string | null;
  },
) {
  const postId = randomUUID();
  const now = new Date("2026-11-19T12:00:00.000Z");
  await db.insert(posts).values({
    id: postId,
    slug: options.slug,
    title: options.slug,
    status: "published",
    publishedAt: now,
    emailHtml: "<p>Body</p>",
    bodyHtml: "<p>Body</p>",
  });
  await db.insert(approvals).values({
    id: randomUUID(),
    postId,
    status: "approved",
    approvedAt: now,
    approvedBy: "did:privy:admin",
    contentHash: `hash-${options.slug}`,
  });
  if (options.receiptStatus) {
    await db.insert(deliveryReceipts).values({
      id: randomUUID(),
      postId,
      channel: "email",
      idempotencyKey: `key-${options.slug}`,
      status: options.receiptStatus,
      attempts: 1,
      lastError: options.lastError ?? null,
      updatedAt: options.updatedAt ?? now,
      completedAt: options.completedAt ?? now,
    });
  }
  return postId;
}

describe("listApprovalQueue", () => {
  let db: DearCreativeDb;
  let client: Client;
  let directory: string;

  beforeEach(async () => {
    directory = mkdtempSync(join(tmpdir(), "dear-list-queue-"));
    client = createClient({ url: `file:${join(directory, "test.db")}` });
    db = drizzle({ client, schema });
    await migrate(db, { migrationsFolder: "./drizzle" });
  });

  afterEach(() => {
    client.close();
    rmSync(directory, { recursive: true, force: true });
  });

  it("computes emailDeliveryPendingStale and only exposes emailDeliveredAt for completed receipts", async () => {
    const now = new Date("2026-11-19T12:10:00.000Z");
    const freshPendingUpdatedAt = new Date(
      now.getTime() - DEFAULT_DELIVERY_PENDING_STALE_MS + 60_000,
    );
    const stalePendingUpdatedAt = new Date(
      now.getTime() - DEFAULT_DELIVERY_PENDING_STALE_MS - 1_000,
    );
    const completedAt = new Date("2026-11-19T12:01:00.000Z");
    const failedUpdatedAt = new Date("2026-11-19T12:02:00.000Z");

    const freshId = await seedPostWithEmailReceipt(db, {
      slug: "fresh-pending",
      receiptStatus: "pending",
      updatedAt: freshPendingUpdatedAt,
      completedAt: freshPendingUpdatedAt,
    });
    const staleId = await seedPostWithEmailReceipt(db, {
      slug: "stale-pending",
      receiptStatus: "pending",
      updatedAt: stalePendingUpdatedAt,
      completedAt: stalePendingUpdatedAt,
    });
    const completedId = await seedPostWithEmailReceipt(db, {
      slug: "completed-email",
      receiptStatus: "completed",
      updatedAt: completedAt,
      completedAt,
    });
    const failedId = await seedPostWithEmailReceipt(db, {
      slug: "failed-email",
      receiptStatus: "failed",
      updatedAt: failedUpdatedAt,
      completedAt: failedUpdatedAt,
      lastError: "Timeout",
    });

    const items = await listApprovalQueue(db, now);
    const byId = new Map(items.map((item) => [item.postId, item]));

    expect(byId.get(freshId)).toMatchObject({
      emailDeliveryStatus: "pending",
      emailDeliveredAt: null,
      emailDeliveryUpdatedAt: freshPendingUpdatedAt.toISOString(),
      emailDeliveryPendingStale: false,
    });
    expect(byId.get(staleId)).toMatchObject({
      emailDeliveryStatus: "pending",
      emailDeliveredAt: null,
      emailDeliveryUpdatedAt: stalePendingUpdatedAt.toISOString(),
      emailDeliveryPendingStale: true,
    });
    expect(byId.get(completedId)).toMatchObject({
      emailDeliveryStatus: "completed",
      emailDeliveredAt: completedAt.toISOString(),
      emailDeliveryUpdatedAt: completedAt.toISOString(),
      emailDeliveryPendingStale: false,
    });
    expect(byId.get(failedId)).toMatchObject({
      emailDeliveryStatus: "failed",
      emailDeliveredAt: null,
      emailDeliveryUpdatedAt: failedUpdatedAt.toISOString(),
      emailDeliveryPendingStale: false,
      emailDeliveryError: "Timeout",
    });
  });
});
