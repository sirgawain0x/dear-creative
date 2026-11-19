import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import { migrate } from "drizzle-orm/libsql/migrator";
import { describe, expect, it } from "vitest";
import * as schema from "@/db/schema";
import { approvals, deliveryReceipts, posts } from "@/db/schema";
import { contentHashForPost } from "./snapshot-from-post";
import { assertDeliverable } from "./delivery-gate";

async function createTestDb() {
  const dir = mkdtempSync(join(tmpdir(), "dear-deliver-gate-"));
  const url = `file:${join(dir, "test.db")}`;
  const client = createClient({ url });
  const db = drizzle({ client, schema });
  await migrate(db, { migrationsFolder: "./drizzle" });
  return db;
}

describe("assertDeliverable", () => {
  it("blocks when approval is missing", async () => {
    const db = await createTestDb();
    const postId = randomUUID();
    await db.insert(posts).values({
      id: postId,
      slug: "x",
      title: "T",
      status: "draft",
    });
    const result = await assertDeliverable(db, postId, "x");
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toBe("not_approved");
    }
  });

  it("allows approved posts within 48 hours", async () => {
    const db = await createTestDb();
    const postId = randomUUID();
    const postRow = {
      id: postId,
      slug: "x",
      title: "T",
      status: "draft" as const,
      teaserText: "Hello",
      emailSubject: null,
      emailHtml: null,
      sponsorId: null,
    };
    await db.insert(posts).values(postRow);
    const hash = contentHashForPost(postRow);
    await db.insert(approvals).values({
      id: randomUUID(),
      postId,
      status: "approved",
      contentHash: hash,
      approvedAt: new Date(),
      approvedBy: "did:privy:g2",
    });

    const result = await assertDeliverable(db, postId, "x");
    expect(result.ok).toBe(true);
  });

  it("blocks Paragraph archive imports from delivery", async () => {
    const db = await createTestDb();
    const postId = randomUUID();
    await db.insert(posts).values({
      id: postId,
      slug: "archive-post",
      title: "Archive",
      status: "published",
      source: "paragraph",
      canonicalUrl: "https://news.creativeplatform.xyz/posts/archive-post",
      sourceGuid:
        "https://news.creativeplatform.xyz/posts/archive-post",
    });
    await db.insert(approvals).values({
      id: randomUUID(),
      postId,
      status: "approved",
      contentHash: "deadbeef",
      approvedAt: new Date(),
      approvedBy: "did:privy:g2",
    });

    const result = await assertDeliverable(db, postId, "email");
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toBe("imported_archive");
    }
  });

  it("blocks Beehiiv archive imports from delivery", async () => {
    const db = await createTestDb();
    const postId = randomUUID();
    await db.insert(posts).values({
      id: postId,
      slug: "beehiiv-archive-post",
      title: "Beehiiv Archive",
      status: "published",
      source: "beehiiv",
      canonicalUrl: "https://dearcrtv.beehiiv.com/p/beehiiv-archive-post",
      sourceGuid: "beehiiv:archive-post",
    });
    await db.insert(approvals).values({
      id: randomUUID(),
      postId,
      status: "approved",
      contentHash: "deadbeef",
      approvedAt: new Date(),
      approvedBy: "did:privy:g2",
    });

    const result = await assertDeliverable(db, postId, "email");
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toBe("imported_archive");
    }
  });

  it("returns already_delivered when a completed email receipt exists even if approval expired or content changed", async () => {
    const db = await createTestDb();
    const postId = randomUUID();
    await db.insert(posts).values({
      id: postId,
      slug: "sent-post",
      title: "Updated title",
      status: "published",
      teaserText: "Hello",
      emailSubject: "Subject",
      emailHtml: "<p>Body</p>",
    });
    await db.insert(approvals).values({
      id: randomUUID(),
      postId,
      status: "approved",
      contentHash: "stale-hash",
      approvedAt: new Date(Date.now() - 72 * 60 * 60 * 1000),
      approvedBy: "did:privy:g2",
    });
    await db.insert(deliveryReceipts).values({
      id: randomUUID(),
      postId,
      channel: "email",
      idempotencyKey: "already-sent-key",
      status: "completed",
      attempts: 1,
      updatedAt: new Date(),
      completedAt: new Date(),
    });

    const result = await assertDeliverable(db, postId, "email");
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toBe("already_delivered");
    }
  });

  it("still allows delivery when a prior email receipt failed", async () => {
    const db = await createTestDb();
    const postId = randomUUID();
    const postRow = {
      id: postId,
      slug: "retry-post",
      title: "Retry",
      status: "published" as const,
      teaserText: "Hello",
      emailSubject: "Subject",
      emailHtml: "<p>Body</p>",
      sponsorId: null,
    };
    await db.insert(posts).values(postRow);
    await db.insert(approvals).values({
      id: randomUUID(),
      postId,
      status: "approved",
      contentHash: contentHashForPost(postRow),
      approvedAt: new Date(),
      approvedBy: "did:privy:g2",
    });
    await db.insert(deliveryReceipts).values({
      id: randomUUID(),
      postId,
      channel: "email",
      idempotencyKey: "failed-key",
      status: "failed",
      attempts: 1,
      lastError: "Temporary error",
      updatedAt: new Date(),
      completedAt: new Date(),
    });

    const result = await assertDeliverable(db, postId, "email");
    expect(result.ok).toBe(true);
  });
});
