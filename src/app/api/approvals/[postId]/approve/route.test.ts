import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import { createClient, type Client } from "@libsql/client";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/libsql";
import { migrate } from "drizzle-orm/libsql/migrator";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getDb, type DearCreativeDb } from "@/db/client";
import * as schema from "@/db/schema";
import { approvals, deliveryReceipts, posts, subscribers } from "@/db/schema";
import { contentHashForPost } from "@/lib/approval/snapshot-from-post";
import { resetResendBroadcastClientForTests } from "@/lib/resend/broadcast";
import { POST } from "./route";

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

vi.mock("next/cache", () => ({
  revalidateTag: vi.fn(),
}));

vi.mock("@/lib/posts/expire-published-post-cache", () => ({
  expirePublishedPostExistenceCache: vi.fn(),
}));

vi.mock("@/lib/privy/require-auth", () => ({
  requirePrivyAuth: vi.fn().mockResolvedValue({
    ok: true,
    user: { userId: "did:privy:admin-1" },
  }),
}));

async function seedPendingPost(db: DearCreativeDb, postId = randomUUID()) {
  const row = {
    id: postId,
    slug: `issue-${postId.slice(0, 8)}`,
    title: "Weekly Issue",
    status: "draft" as const,
    teaserText: "Teaser copy",
    emailSubject: "Weekly Issue Subject",
    emailHtml: "<p>Hello subscribers</p>",
    bodyHtml: "<p>Hello subscribers</p>",
    sponsorId: null,
  };
  await db.insert(posts).values(row);
  await db.insert(approvals).values({
    id: randomUUID(),
    postId,
    status: "pending",
    contentHash: contentHashForPost(row),
  });
  return postId;
}

describe("POST /api/approvals/[postId]/approve", () => {
  let db: DearCreativeDb;
  let client: Client;
  let directory: string;

  beforeEach(async () => {
    batchSend.mockReset();
    ResendMock.mockClear();
    resetResendBroadcastClientForTests();

    vi.stubEnv("RESEND_API_KEY", "re_test_key");
    vi.stubEnv("RESEND_FROM", "Dear Creative <news@example.test>");
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://dear.example.test");
    vi.stubEnv("SUBSCRIBER_TOKEN_SECRET", "test-unsub-secret");
    vi.stubEnv("RESEND_LIVE", "true");

    directory = mkdtempSync(join(tmpdir(), "dear-approve-route-"));
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
    client.close();
    rmSync(directory, { recursive: true, force: true });
    vi.unstubAllEnvs();
    resetResendBroadcastClientForTests();
  });

  it("approves, publishes, and sends newsletter email once", async () => {
    batchSend.mockResolvedValue({
      data: { data: [{ id: "broadcast-1" }] },
      error: null,
    });

    const postId = await seedPendingPost(db);
    const response = await POST(
      new Request(`http://localhost/api/approvals/${postId}/approve`, {
        method: "POST",
      }),
      { params: Promise.resolve({ postId }) },
    );

    expect(response.status).toBe(200);
    const body = (await response.json()) as {
      outcome: string;
      postId: string;
      emailDelivery: { outcome: string; broadcastId?: string };
    };
    expect(body.outcome).toBe("approved");
    expect(body.postId).toBe(postId);
    expect(body.emailDelivery).toMatchObject({
      outcome: "sent",
      broadcastId: "broadcast-1",
      dryRun: false,
    });
    expect(batchSend).toHaveBeenCalledTimes(1);

    const [post] = await db.select().from(posts).where(eq(posts.id, postId));
    expect(post?.status).toBe("published");
    const [receipt] = await db
      .select()
      .from(deliveryReceipts)
      .where(eq(deliveryReceipts.postId, postId));
    expect(receipt?.status).toBe("completed");
  });

  it("still approves and returns 200 when email provider fails or is unconfigured", async () => {
    batchSend.mockResolvedValue({
      data: null,
      error: { message: "Resend outage" },
    });

    const failingPostId = await seedPendingPost(db);
    const failedRes = await POST(
      new Request(`http://localhost/api/approvals/${failingPostId}/approve`, {
        method: "POST",
      }),
      { params: Promise.resolve({ postId: failingPostId }) },
    );
    expect(failedRes.status).toBe(200);
    const failedBody = (await failedRes.json()) as {
      outcome: string;
      emailDelivery: { outcome: string; errorMessage?: string };
    };
    expect(failedBody.outcome).toBe("approved");
    expect(failedBody.emailDelivery).toEqual({
      outcome: "provider_failed",
      errorMessage: "Resend outage",
    });

    vi.stubEnv("RESEND_API_KEY", "");
    resetResendBroadcastClientForTests();

    const unconfiguredPostId = await seedPendingPost(db);
    const unconfiguredRes = await POST(
      new Request(
        `http://localhost/api/approvals/${unconfiguredPostId}/approve`,
        { method: "POST" },
      ),
      { params: Promise.resolve({ postId: unconfiguredPostId }) },
    );
    expect(unconfiguredRes.status).toBe(200);
    const unconfiguredBody = (await unconfiguredRes.json()) as {
      outcome: string;
      emailDelivery: { outcome: string; reason?: string };
    };
    expect(unconfiguredBody.outcome).toBe("approved");
    expect(unconfiguredBody.emailDelivery).toEqual({
      outcome: "blocked",
      reason: "client_unconfigured",
    });
  });

  it("does not re-send email when a completed email delivery receipt already exists", async () => {
    const postId = await seedPendingPost(db);
    await db.insert(deliveryReceipts).values({
      id: randomUUID(),
      postId,
      channel: "email",
      idempotencyKey: "prior-email-send",
      status: "completed",
      attempts: 1,
      updatedAt: new Date(),
      completedAt: new Date(),
    });

    const response = await POST(
      new Request(`http://localhost/api/approvals/${postId}/approve`, {
        method: "POST",
      }),
      { params: Promise.resolve({ postId }) },
    );

    expect(response.status).toBe(200);
    const body = (await response.json()) as {
      outcome: string;
      emailDelivery: { outcome: string; reason?: string };
    };
    expect(body.outcome).toBe("approved");
    expect(body.emailDelivery).toEqual({
      outcome: "blocked",
      reason: "already_delivered",
    });
    expect(batchSend).not.toHaveBeenCalled();
  });
});
