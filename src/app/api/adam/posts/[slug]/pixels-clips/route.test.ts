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

describe("POST /api/adam/posts/[slug]/pixels-clips", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    getDbMock.mockReset();
  });

  it("requires Adam auth", async () => {
    vi.stubEnv("ADAM_API_TOKEN", "secret-token");
    const { POST } = await import("./route");
    const response = await POST(
      new Request("http://localhost/api/adam/posts/demo/pixels-clips", {
        method: "POST",
        body: JSON.stringify({ dryRun: true }),
      }),
      { params: Promise.resolve({ slug: "demo" }) },
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
      new Request("http://localhost/api/adam/posts/clip-ready/pixels-clips", {
        method: "POST",
        headers: { Authorization: "Bearer secret-token" },
        body: JSON.stringify({ dryRun: true }),
      }),
      { params: Promise.resolve({ slug: "clip-ready" }) },
    );

    expect(response.status).toBe(200);
    const body = (await response.json()) as { dryRun: boolean; slug: string };
    expect(body.dryRun).toBe(true);
    expect(body.slug).toBe("clip-ready");
  });
});
