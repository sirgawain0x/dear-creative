import { afterEach, describe, expect, it, vi } from "vitest";
import { setPostAudioColumns } from "@/db/ensure-schema";
import {
  createPostsTestDb,
  insertPost,
} from "@/lib/posts/test-support/posts-test-db";

const { getDbMock } = vi.hoisted(() => ({
  getDbMock: vi.fn(),
}));

vi.mock("@/db/client", () => ({
  getDb: getDbMock,
}));

describe("POST /api/adam/posts/pixels-clips", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    getDbMock.mockReset();
  });

  it("requires Adam auth", async () => {
    vi.stubEnv("ADAM_API_TOKEN", "secret-token");
    const { POST } = await import("./route");
    const response = await POST(
      new Request("http://localhost/api/adam/posts/pixels-clips", {
        method: "POST",
        body: JSON.stringify({ slug: "demo", dryRun: true }),
      }),
    );
    expect(response.status).toBe(401);
  });

  it("returns dry-run preview for published posts", async () => {
    vi.stubEnv("ADAM_API_TOKEN", "secret-token");
    const db = await createPostsTestDb();
    getDbMock.mockReturnValue(db);
    await insertPost(db, {
      slug: "clip-ready",
      title: "Clip Ready",
      status: "published",
      publishedAt: new Date("2025-02-01T00:00:00.000Z"),
      bodyHtml:
        '<video src="https://api.grove.storage/v16.mp4"></video><video src="https://api.grove.storage/v9.mp4"></video>',
    });
    const row = await db.query.posts.findFirst({
      where: (posts, { eq }) => eq(posts.slug, "clip-ready"),
    });
    if (!row) {
      throw new Error("missing row");
    }
    await setPostAudioColumns(db, row.id, {
      audioUrl: "https://api.grove.storage/narration.mp3",
      audioVoice: "Puck",
    });

    const { POST } = await import("./route");
    const response = await POST(
      new Request("http://localhost/api/adam/posts/pixels-clips", {
        method: "POST",
        headers: { Authorization: "Bearer secret-token" },
        body: JSON.stringify({ slug: "clip-ready", dryRun: true }),
      }),
    );

    expect(response.status).toBe(200);
    const body = (await response.json()) as { dryRun: boolean; slug: string };
    expect(body.dryRun).toBe(true);
    expect(body.slug).toBe("clip-ready");
  });

  it("defaults to dryRun when the body contains only slug", async () => {
    vi.stubEnv("ADAM_API_TOKEN", "secret-token");
    const db = await createPostsTestDb();
    getDbMock.mockReturnValue(db);
    await insertPost(db, {
      slug: "clip-ready",
      title: "Clip Ready",
      status: "published",
      publishedAt: new Date("2025-02-01T00:00:00.000Z"),
      bodyHtml:
        '<video src="https://api.grove.storage/v16.mp4"></video><video src="https://api.grove.storage/v9.mp4"></video>',
    });
    const row = await db.query.posts.findFirst({
      where: (posts, { eq }) => eq(posts.slug, "clip-ready"),
    });
    if (!row) {
      throw new Error("missing row");
    }
    await setPostAudioColumns(db, row.id, {
      audioUrl: "https://api.grove.storage/narration.mp3",
      audioVoice: "Puck",
    });

    const { POST } = await import("./route");
    const response = await POST(
      new Request("http://localhost/api/adam/posts/pixels-clips", {
        method: "POST",
        headers: { Authorization: "Bearer secret-token" },
        body: JSON.stringify({ slug: "clip-ready" }),
      }),
    );

    expect(response.status).toBe(200);
    const body = (await response.json()) as { dryRun: boolean };
    expect(body.dryRun).toBe(true);
  });

  it("returns 404 for a draft slug", async () => {
    vi.stubEnv("ADAM_API_TOKEN", "secret-token");
    const db = await createPostsTestDb();
    getDbMock.mockReturnValue(db);
    await insertPost(db, {
      slug: "draft-only",
      title: "Draft",
      status: "draft",
      publishedAt: null,
      bodyHtml:
        '<video src="https://api.grove.storage/v16.mp4"></video><video src="https://api.grove.storage/v9.mp4"></video>',
    });

    const { POST } = await import("./route");
    const response = await POST(
      new Request("http://localhost/api/adam/posts/pixels-clips", {
        method: "POST",
        headers: { Authorization: "Bearer secret-token" },
        body: JSON.stringify({ slug: "draft-only" }),
      }),
    );

    expect(response.status).toBe(404);
  });

  it("returns 404 for a missing slug", async () => {
    vi.stubEnv("ADAM_API_TOKEN", "secret-token");
    const db = await createPostsTestDb();
    getDbMock.mockReturnValue(db);

    const { POST } = await import("./route");
    const response = await POST(
      new Request("http://localhost/api/adam/posts/pixels-clips", {
        method: "POST",
        headers: { Authorization: "Bearer secret-token" },
        body: JSON.stringify({ slug: "does-not-exist" }),
      }),
    );

    expect(response.status).toBe(404);
  });
});
