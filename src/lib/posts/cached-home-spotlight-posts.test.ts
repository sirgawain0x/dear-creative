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

  it("returns up to HOME_SPOTLIGHT_LIMIT newest visible posts in descending publish order", async () => {
    const db = await createPostsTestDb();
    getDb.mockReturnValue(db);
    const asOf = new Date("2026-10-20T00:00:00.000Z");
    vi.useFakeTimers({ now: asOf });

    for (let i = 0; i < 15; i += 1) {
      await insertPost(db, {
        slug: `spotlight-post-${i}`,
        title: `Post ${i}`,
        status: "published",
        publishedAt: new Date(Date.UTC(2025, 0, 1 + i, 12, 0, 0)),
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
    const expectedSlugs = Array.from({ length: HOME_SPOTLIGHT_LIMIT }, (_, j) =>
      String(`spotlight-post-${14 - j}`),
    );
    expect(cached.map((p) => p.slug)).toEqual(expectedSlugs);
    for (const item of cached) {
      expect(item).not.toHaveProperty("bodyHtml");
    }
  });
});
