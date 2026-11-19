import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import { createClient, type Client } from "@libsql/client";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/libsql";
import { migrate } from "drizzle-orm/libsql/migrator";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { DearCreativeDb } from "@/db/client";
import * as schema from "@/db/schema";
import {
  approvals,
  auditEvents,
  deliveryReceipts,
  posts,
  subscribers,
} from "@/db/schema";
import { setPostNarrationAfterHookForTests } from "@/lib/audio/schedule-narration-regeneration";
import { resetResendBroadcastClientForTests } from "@/lib/resend/broadcast";
import { publishScheduledPosts } from "./publish-scheduled-posts";

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

describe("publishScheduledPosts", () => {
  let db: DearCreativeDb;
  let client: Client;
  let directory: string;

  beforeEach(async () => {
    setPostNarrationAfterHookForTests(() => {});
    batchSend.mockReset();
    ResendMock.mockClear();
    resetResendBroadcastClientForTests();

    vi.stubEnv("RESEND_API_KEY", "re_test_key");
    vi.stubEnv("RESEND_FROM", "Dear Creative <news@example.test>");
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://dear.example.test");
    vi.stubEnv("SUBSCRIBER_TOKEN_SECRET", "test-unsub-secret");
    vi.stubEnv("RESEND_LIVE", "true");

    directory = mkdtempSync(join(tmpdir(), "dear-publish-sched-"));
    client = createClient({ url: `file:${join(directory, "test.db")}` });
    db = drizzle({ client, schema });
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
    setPostNarrationAfterHookForTests(null);
    client.close();
    rmSync(directory, { recursive: true, force: true });
    vi.unstubAllEnvs();
    resetResendBroadcastClientForTests();
  });

  it("publishes due scheduled post, upserts approval, emits audit events, and sends email once", async () => {
    batchSend.mockResolvedValue({
      data: { data: [{ id: "sched-broadcast-1" }] },
      error: null,
    });

    const now = new Date("2026-11-20T14:00:00.000Z");
    const postId = randomUUID();
    await db.insert(posts).values({
      id: postId,
      slug: "scheduled-issue",
      title: "Scheduled Issue",
      status: "scheduled",
      publishedAt: new Date("2026-11-20T13:00:00.000Z"),
      teaserText: "Scheduled teaser",
      emailSubject: "Scheduled Subject",
      emailHtml: "<p>Scheduled body</p>",
      bodyHtml: "<p>Scheduled body</p>",
    });

    const result = await publishScheduledPosts(db, now);
    expect(result.published).toEqual(["scheduled-issue"]);
    expect(result.blocked).toEqual([]);
    expect(result.emailDelivery).toEqual([
      {
        postId,
        slug: "scheduled-issue",
        result: {
          outcome: "sent",
          broadcastId: "sched-broadcast-1",
          dryRun: false,
        },
      },
    ]);
    expect(batchSend).toHaveBeenCalledTimes(1);

    const [post] = await db.select().from(posts).where(eq(posts.id, postId));
    expect(post?.status).toBe("published");

    const [approval] = await db
      .select()
      .from(approvals)
      .where(eq(approvals.postId, postId));
    expect(approval?.status).toBe("approved");
    expect(approval?.approvedBy).toBe("adam-scheduler");

    const scheduleEvents = await db
      .select()
      .from(auditEvents)
      .where(eq(auditEvents.action, "post.published_from_schedule"));
    expect(scheduleEvents).toHaveLength(1);

    const publishedEvents = await db
      .select()
      .from(auditEvents)
      .where(eq(auditEvents.action, "post.published"));
    expect(publishedEvents).toHaveLength(1);

    const [receipt] = await db
      .select()
      .from(deliveryReceipts)
      .where(eq(deliveryReceipts.postId, postId));
    expect(receipt?.status).toBe("completed");
  });

  it("does not re-send email when an already-emailed post is moved to draft and re-scheduled", async () => {
    batchSend.mockResolvedValue({
      data: { data: [{ id: "sched-broadcast-first" }] },
      error: null,
    });

    const firstPublishAt = new Date("2026-11-20T14:00:00.000Z");
    const postId = randomUUID();
    await db.insert(posts).values({
      id: postId,
      slug: "rescheduled-issue",
      title: "Rescheduled Issue",
      status: "scheduled",
      publishedAt: new Date("2026-11-20T13:00:00.000Z"),
      teaserText: "Teaser",
      emailSubject: "Subject",
      emailHtml: "<p>Body</p>",
      bodyHtml: "<p>Body</p>",
    });

    const firstResult = await publishScheduledPosts(db, firstPublishAt);
    expect(firstResult.emailDelivery[0]?.result.outcome).toBe("sent");
    expect(batchSend).toHaveBeenCalledTimes(1);

    const secondScheduleTime = new Date("2026-11-21T13:00:00.000Z");
    await db
      .update(posts)
      .set({
        status: "scheduled",
        publishedAt: secondScheduleTime,
        updatedAt: new Date("2026-11-20T15:00:00.000Z"),
      })
      .where(eq(posts.id, postId));

    const secondPublishAt = new Date("2026-11-21T14:00:00.000Z");
    const secondResult = await publishScheduledPosts(db, secondPublishAt);
    expect(secondResult.published).toEqual(["rescheduled-issue"]);
    expect(secondResult.emailDelivery).toEqual([
      {
        postId,
        slug: "rescheduled-issue",
        result: { outcome: "blocked", reason: "already_delivered" },
      },
    ]);
    expect(batchSend).toHaveBeenCalledTimes(1);
  });
});
