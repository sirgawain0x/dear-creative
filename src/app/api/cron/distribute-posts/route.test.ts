import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import { createClient, type Client } from "@libsql/client";
import { and, eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/libsql";
import { migrate } from "drizzle-orm/libsql/migrator";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getDb, type DearCreativeDb } from "@/db/client";
import * as schema from "@/db/schema";
import {
  approvals,
  auditEvents,
  deliveryReceipts,
  posts,
  subscribers,
} from "@/db/schema";
import { getEnabledChannels } from "@/lib/adam/distribution-config";
import { contentHashForPost } from "@/lib/approval/snapshot-from-post";
import { resetResendBroadcastClientForTests } from "@/lib/resend/broadcast";
import { GET } from "./route";

const { batchSend, ResendMock } = vi.hoisted(() => {
  const batchSend = vi.fn();
  const ResendMock = vi.fn(function ResendMock(this: unknown) {
    return {
      emails: { send: vi.fn() },
      batch: { send: batchSend },
    };
  });
  return { batchSend, ResendMock };
});

vi.mock("resend", () => ({
  Resend: ResendMock,
}));

vi.mock("@/db/client", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/db/client")>()),
  getDb: vi.fn(),
}));

async function seedPublishedPost(
  db: DearCreativeDb,
  options: { slug?: string; emitEvent?: boolean } = {},
) {
  const postId = randomUUID();
  const slug = options.slug ?? `post-${postId.slice(0, 8)}`;
  const now = new Date();
  const row = {
    id: postId,
    slug,
    title: "Distributed Issue",
    status: "published" as const,
    publishedAt: now,
    teaserText: "Short teaser",
    emailSubject: "Distributed Subject",
    emailHtml: "<p>Email body</p>",
    bodyHtml: "<p>Email body</p>",
    sponsorId: null,
  };
  await db.insert(posts).values(row);
  await db.insert(approvals).values({
    id: randomUUID(),
    postId,
    status: "approved",
    contentHash: contentHashForPost(row),
    approvedAt: now,
    approvedBy: "did:privy:admin",
  });
  if (options.emitEvent !== false) {
    await db.insert(auditEvents).values({
      id: randomUUID(),
      actor: "did:privy:admin",
      action: "post.published",
      entityType: "post",
      entityId: postId,
      payloadJson: JSON.stringify({
        postId,
        slug,
        title: row.title,
        publishedAt: now.toISOString(),
      }),
      createdAt: now,
    });
  }
  return { postId, slug };
}

describe("GET /api/cron/distribute-posts", () => {
  let db: DearCreativeDb;
  let client: Client;
  let directory: string;

  beforeEach(async () => {
    batchSend.mockReset();
    ResendMock.mockClear();
    resetResendBroadcastClientForTests();

    vi.stubEnv("CRON_SECRET", "cron-secret-test");
    vi.stubEnv("ADAM_API_TOKEN", "adam-token-test");
    vi.stubEnv("RESEND_API_KEY", "re_test_key");
    vi.stubEnv("RESEND_FROM", "Dear Creative <news@example.test>");
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://dear.example.test");
    vi.stubEnv("SUBSCRIBER_TOKEN_SECRET", "test-unsub-secret");
    vi.stubEnv("RESEND_LIVE", "true");
    vi.stubEnv("FARCASTER_ENABLED", "false");
    vi.stubEnv("DISCORD_WEBHOOK_URL", "");
    vi.stubEnv("ORB_API_TOKEN", "");

    vi.spyOn(globalThis, "fetch").mockImplementation(async () =>
      new Response(JSON.stringify({ outcome: "posted", tweetId: "tweet-1" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );

    directory = mkdtempSync(join(tmpdir(), "dear-distribute-cron-"));
    client = createClient({ url: `file:${join(directory, "test.db")}` });
    db = drizzle({ client, schema });
    vi.mocked(getDb).mockReturnValue(db);
    await migrate(db, { migrationsFolder: "./drizzle" });

    await db.insert(subscribers).values({
      id: randomUUID(),
      email: "reader@example.test",
      status: "subscribed",
      source: "signup",
      subscribedAt: new Date(),
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    client.close();
    rmSync(directory, { recursive: true, force: true });
    vi.unstubAllEnvs();
    resetResendBroadcastClientForTests();
  });

  it("includes email in getEnabledChannels()", () => {
    expect(getEnabledChannels()).toContain("email");
  });

  it("rejects unauthorized requests", async () => {
    const res = await GET(
      new Request("http://localhost/api/cron/distribute-posts"),
    );
    expect(res.status).toBe(401);
  });

  it("distributes unsent posts via email and skips posts already delivered via email", async () => {
    batchSend.mockResolvedValue({
      data: { data: [{ id: "cron-broadcast-1" }] },
      error: null,
    });

    const { postId: unsentId } = await seedPublishedPost(db, {
      slug: "unsent-post",
    });
    const { postId: alreadySentId } = await seedPublishedPost(db, {
      slug: "already-sent-post",
    });
    await db.insert(deliveryReceipts).values({
      id: randomUUID(),
      postId: alreadySentId,
      channel: "email",
      idempotencyKey: "prior-approve-send",
      status: "completed",
      attempts: 1,
      updatedAt: new Date(),
      completedAt: new Date(),
    });

    const res = await GET(
      new Request("http://localhost/api/cron/distribute-posts", {
        headers: { Authorization: "Bearer cron-secret-test" },
      }),
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      ok: boolean;
      distributed: number;
      channels: string[];
      results: Array<{ postId: string; channel: string; status: string }>;
    };
    expect(body.ok).toBe(true);
    expect(body.distributed).toBe(2);
    expect(body.channels).toContain("email");
    expect(body.results).toContainEqual(
      expect.objectContaining({
        postId: unsentId,
        channel: "email",
        status: "sent",
      }),
    );
    expect(body.results).toContainEqual(
      expect.objectContaining({
        postId: alreadySentId,
        channel: "email",
        status: "already_delivered",
      }),
    );
    expect(batchSend).toHaveBeenCalledTimes(1);
  });

  it("retries a failed email delivery receipt and completes it", async () => {
    batchSend.mockResolvedValue({
      data: { data: [{ id: "cron-retry-ok" }] },
      error: null,
    });

    const { postId } = await seedPublishedPost(db, { slug: "retry-post" });
    await db.insert(deliveryReceipts).values({
      id: randomUUID(),
      postId,
      channel: "email",
      idempotencyKey: "failed-email-attempt",
      status: "failed",
      attempts: 1,
      lastError: "Temporary failure",
      updatedAt: new Date(),
      completedAt: new Date(),
    });

    const res = await GET(
      new Request("http://localhost/api/cron/distribute-posts", {
        headers: { Authorization: "Bearer cron-secret-test" },
      }),
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      ok: boolean;
      results: Array<{ postId: string; channel: string; status: string }>;
    };
    expect(body.ok).toBe(true);
    expect(body.results).toContainEqual(
      expect.objectContaining({
        postId,
        channel: "email",
        status: "sent",
      }),
    );
    expect(batchSend).toHaveBeenCalledTimes(1);

    const [receipt] = await db
      .select()
      .from(deliveryReceipts)
      .where(
        and(
          eq(deliveryReceipts.postId, postId),
          eq(deliveryReceipts.channel, "email"),
        ),
      );
    expect(receipt?.status).toBe("completed");
  });

  it("deduplicates multiple post.published events for the same postId", async () => {
    batchSend.mockResolvedValue({
      data: { data: [{ id: "cron-dedupe-1" }] },
      error: null,
    });

    const { postId, slug } = await seedPublishedPost(db, {
      slug: "deduped-post",
    });
    await db.insert(auditEvents).values({
      id: randomUUID(),
      actor: "did:privy:admin",
      action: "post.published",
      entityType: "post",
      entityId: postId,
      payloadJson: JSON.stringify({
        postId,
        slug,
        title: "Distributed Issue",
        publishedAt: new Date().toISOString(),
      }),
      createdAt: new Date(),
    });

    const res = await GET(
      new Request("http://localhost/api/cron/distribute-posts", {
        headers: { Authorization: "Bearer cron-secret-test" },
      }),
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      ok: boolean;
      distributed: number;
      results: Array<{ postId: string; channel: string; status: string }>;
    };
    expect(body.ok).toBe(true);
    expect(body.distributed).toBe(1);
    expect(
      body.results.filter((r) => r.postId === postId && r.channel === "email"),
    ).toHaveLength(1);
    expect(batchSend).toHaveBeenCalledTimes(1);
  });
});
