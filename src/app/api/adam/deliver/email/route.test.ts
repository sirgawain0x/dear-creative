import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import { createClient, type Client } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import { migrate } from "drizzle-orm/libsql/migrator";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getDb, type DearCreativeDb } from "@/db/client";
import * as schema from "@/db/schema";
import { approvals, posts, subscribers } from "@/db/schema";
import { contentHashForPost } from "@/lib/approval/snapshot-from-post";
import { requirePrivyAuth } from "@/lib/privy/require-auth";
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

vi.mock("@/lib/privy/require-auth", () => ({
  requirePrivyAuth: vi.fn(),
}));

async function seedApprovedPost(db: DearCreativeDb) {
  const postId = randomUUID();
  const now = new Date();
  const row = {
    id: postId,
    slug: `manual-send-${postId.slice(0, 8)}`,
    title: "Manual Newsletter",
    status: "published" as const,
    publishedAt: now,
    teaserText: "Teaser",
    emailSubject: "Manual Subject",
    emailHtml: "<p>Hello</p>",
    bodyHtml: "<p>Hello</p>",
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
  return postId;
}

describe("POST /api/adam/deliver/email", () => {
  let db: DearCreativeDb;
  let client: Client;
  let directory: string;

  beforeEach(async () => {
    batchSend.mockReset();
    ResendMock.mockClear();
    resetResendBroadcastClientForTests();

    vi.stubEnv("ADAM_API_TOKEN", "adam-secret-token");
    vi.stubEnv("RESEND_API_KEY", "re_test_key");
    vi.stubEnv("RESEND_FROM", "Dear Creative <news@example.test>");
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://dear.example.test");
    vi.stubEnv("SUBSCRIBER_TOKEN_SECRET", "test-unsub-secret");
    vi.stubEnv("RESEND_LIVE", "true");

    vi.mocked(requirePrivyAuth).mockResolvedValue({
      ok: false,
      response: new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
      }) as never,
    });

    directory = mkdtempSync(join(tmpdir(), "dear-deliver-email-route-"));
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

  it("rejects unauthenticated requests with 401", async () => {
    const res = await POST(
      new Request("http://localhost/api/adam/deliver/email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ postId: "p1", idempotencyKey: "k1" }),
      }),
    );
    expect(res.status).toBe(401);
  });

  it("authorizes ADAM_API_TOKEN and returns 409 already_delivered on duplicate send", async () => {
    batchSend.mockResolvedValue({
      data: { data: [{ id: "adam-broadcast-1" }] },
      error: null,
    });

    const postId = await seedApprovedPost(db);
    const first = await POST(
      new Request("http://localhost/api/adam/deliver/email", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer adam-secret-token",
        },
        body: JSON.stringify({ postId, idempotencyKey: "adam-key-1" }),
      }),
    );
    expect(first.status).toBe(200);
    expect(await first.json()).toMatchObject({
      outcome: "sent",
      broadcastId: "adam-broadcast-1",
    });
    expect(batchSend).toHaveBeenCalledTimes(1);

    const second = await POST(
      new Request("http://localhost/api/adam/deliver/email", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer adam-secret-token",
        },
        body: JSON.stringify({ postId, idempotencyKey: "adam-key-2" }),
      }),
    );
    expect(second.status).toBe(409);
    expect(await second.json()).toEqual({
      error: "Delivery blocked",
      reason: "already_delivered",
    });
    expect(batchSend).toHaveBeenCalledTimes(1);
  });

  it("authorizes Privy admin sessions", async () => {
    batchSend.mockResolvedValue({
      data: { data: [{ id: "privy-broadcast-1" }] },
      error: null,
    });
    vi.mocked(requirePrivyAuth).mockResolvedValue({
      ok: true,
      user: { userId: "did:privy:admin-user" },
    });

    const postId = await seedApprovedPost(db);
    const res = await POST(
      new Request("http://localhost/api/adam/deliver/email", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer privy-jwt",
        },
        body: JSON.stringify({ postId, idempotencyKey: "privy-key-1" }),
      }),
    );
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({
      outcome: "sent",
      broadcastId: "privy-broadcast-1",
    });
    expect(batchSend).toHaveBeenCalledTimes(1);
  });
});
