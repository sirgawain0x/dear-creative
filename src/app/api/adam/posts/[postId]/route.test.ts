import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createClient, type Client } from "@libsql/client";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/libsql";
import { migrate } from "drizzle-orm/libsql/migrator";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getDb, type DearCreativeDb } from "@/db/client";
import * as schema from "@/db/schema";
import { GET as runScheduler } from "@/app/api/cron/publish-scheduled-posts/route";
import { listApprovalQueue } from "@/lib/approval/list-queue";
import { listAdminPosts } from "@/lib/posts/manage-posts";
import { publishedVisibilityFilter } from "@/lib/posts/published-posts";
import { DELETE, GET, PATCH } from "./route";

vi.mock("@/db/client", async (importOriginal) => ({
  ...await importOriginal<typeof import("@/db/client")>(),
  getDb: vi.fn(),
}));
vi.mock("@/lib/adam/studio-auth", () => ({
  requireStudioOrAdamAuth: async (request: Request) => {
    const { requireAdamAuth } = await import("@/lib/adam/require-auth");
    return requireAdamAuth(request);
  },
}));
vi.mock("next/cache", () => ({ revalidateTag: vi.fn() }));

const headers = { authorization: "Bearer route-test-token", "content-type": "application/json" };
const context = { params: Promise.resolve({ postId: "post" }) };
const postUrl = "http://localhost/api/adam/posts/post";
const cronUrl = "http://localhost/api/cron/publish-scheduled-posts";

function patch(body: object) {
  return PATCH(new Request(postUrl, { method: "PATCH", headers, body: JSON.stringify(body) }), context);
}

describe("Studio post lifecycle", () => {
  let db: DearCreativeDb;
  let client: Client;
  let directory: string;

  beforeEach(async () => {
    vi.stubEnv("ADAM_API_TOKEN", "route-test-token");
    directory = mkdtempSync(join(tmpdir(), "dear-post-lifecycle-"));
    client = createClient({ url: `file:${join(directory, "test.db")}` });
    db = drizzle({ client, schema });
    vi.mocked(getDb).mockReturnValue(db);
    await migrate(db, { migrationsFolder: "./drizzle" });
    await db.insert(schema.posts).values({ id: "post", slug: "test-post", title: "Test Post" });
  });

  afterEach(() => {
    client.close();
    rmSync(directory, { recursive: true, force: true });
    vi.unstubAllEnvs();
    vi.useRealTimers();
  });

  it("deletes a previously published draft from Studio and blocks reopening it", async () => {
    await db.update(schema.posts).set({ status: "published", publishedAt: new Date() });
    await db.insert(schema.approvals).values({ id: "approval", postId: "post", contentHash: "hash" });
    const remove = () => DELETE(new Request(postUrl, { method: "DELETE", headers }), context);
    expect((await DELETE(new Request(postUrl, { method: "DELETE" }), context)).status).toBe(401);
    expect((await remove()).status).toBe(409);
    expect((await patch({ status: "draft" })).status).toBe(200);
    expect((await remove()).status).toBe(200);
    expect((await GET(new Request(postUrl, { headers }), context)).status).toBe(404);
    expect((await patch({ status: "published" })).status).toBe(404);
    expect(await listAdminPosts(db)).toEqual([]);
    expect(await listApprovalQueue(db)).toEqual([]);
  });

  it("validates, reschedules, cancels and publishes through the authenticated worker", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-11-16T13:00:00Z"));
    const monday = "2026-11-16T14:00:00.000Z";
    const thursday = "2026-11-19T14:00:00.000Z";
    const run = () => runScheduler(new Request(cronUrl, { headers }));
    const schedule = (scheduledAt: string) => patch({ status: "scheduled", scheduledAt });

    expect((await runScheduler(new Request(cronUrl))).status).toBe(401);
    expect((await schedule("2026-11-15T14:00:00.000Z")).status).toBe(400);
    expect((await schedule(monday)).status).toBe(200);
    expect((await schedule(thursday)).status).toBe(200);
    expect(await listAdminPosts(db, { status: "scheduled" })).toMatchObject([{ publishedAt: thursday }]);
    vi.setSystemTime(new Date(monday));
    expect(await (await run()).json()).toMatchObject({ published: [] });
    expect(await db.select().from(schema.posts).where(publishedVisibilityFilter())).toEqual([]);
    expect((await patch({ status: "draft" })).status).toBe(200);
    expect(await listAdminPosts(db, { status: "scheduled" })).toEqual([]);

    expect((await schedule(thursday)).status).toBe(200);
    vi.setSystemTime(new Date(thursday));
    expect(await (await run()).json()).toMatchObject({ published: ["test-post"] });
    expect(await db.select().from(schema.posts).where(publishedVisibilityFilter())).toMatchObject([
      { status: "published", publishedAt: new Date(thursday) },
    ]);
    expect(await (await run()).json()).toMatchObject({ published: [] });
    expect(await db.select().from(schema.auditEvents)
      .where(eq(schema.auditEvents.action, "post.published_from_schedule"))).toHaveLength(1);
  });
});
