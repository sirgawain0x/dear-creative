import { describe, expect, it, vi, afterEach } from "vitest";
import {
  createPostsTestDb,
  insertPost,
} from "@/lib/posts/test-support/posts-test-db";
import { HOME_SPOTLIGHT_LIMIT } from "./home-spotlight";

vi.mock("next/cache", () => ({
  cacheLife: () => {},
  cacheTag: () => {},
}));

const { getDb } = vi.hoisted(() => ({
  getDb: vi.fn(),
}));

vi.mock("@/db/client", () => ({
  getDb,
}));

describe("getCachedHomeSpotlightPosts", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns three newest visible posts in descending publish order", async () => {
    const db = await createPostsTestDb();
    getDb.mockReturnValue(db);
    const asOf = new Date("2026-10-20T00:00:00.000Z");
    vi.useFakeTimers({ now: asOf });

    for (let i = 0; i < 5; i += 1) {
      await insertPost(db, {
        slug: `spotlight-post-${i}`,
        title: `Post ${i}`,
        status: "published",
        publishedAt: new Date(
          `2026-10-${String(i + 1).padStart(2, "0")}T12:00:00.000Z`,
        ),
      });
    }

    await insertPost(db, {
      slug: "spotlight-draft",
      title: "Draft",
      status: "draft",
      publishedAt: null,
    });
    await insertPost(db, {
      slug: "spotlight-future",
      title: "Future",
      status: "published",
      publishedAt: new Date("2026-11-01T12:00:00.000Z"),
    });

    const { getCachedHomeSpotlightPosts } = await import(
      "./cached-home-spotlight-posts"
    );
    const cached = await getCachedHomeSpotlightPosts();

    expect(cached).toHaveLength(HOME_SPOTLIGHT_LIMIT);
    expect(cached.map((p) => p.slug)).toEqual([
      "spotlight-post-4",
      "spotlight-post-3",
      "spotlight-post-2",
    ]);
    for (const item of cached) {
      expect(item).not.toHaveProperty("bodyHtml");
    }
  });
});
