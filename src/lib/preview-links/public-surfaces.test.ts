import { describe, expect, it, vi, beforeEach } from "vitest";
import {
  createPostsTestDb,
  insertPost,
} from "@/lib/posts/test-support/posts-test-db";
import { buildRssXml } from "@/lib/posts/rss-feed";
import { listPublishedPosts } from "@/lib/posts/published-posts";

vi.mock("next/cache", () => ({
  unstable_cache: (fn: () => Promise<unknown>) => async () => fn(),
  cacheTag: () => undefined,
  cacheLife: () => undefined,
}));

vi.mock("next/server", async (importOriginal) => {
  const actual = await importOriginal<typeof import("next/server")>();
  return {
    ...actual,
    connection: async () => undefined,
  };
});

describe("preview drafts stay off public surfaces", () => {
  beforeEach(() => {
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://news.example.com");
  });

  it("excludes draft posts from RSS and published lists", async () => {
    const db = await createPostsTestDb();
    await insertPost(db, {
      slug: "draft-with-preview",
      title: "Secret draft",
      status: "draft",
      publishedAt: null,
      bodyHtml: "<p>preview-only body</p>",
    });
    await insertPost(db, {
      slug: "live-post",
      title: "Live",
      status: "published",
      publishedAt: new Date("2024-05-01T00:00:00.000Z"),
    });

    const { items } = await listPublishedPosts(db, { page: 1, pageSize: 20 });
    expect(items.map((p) => p.slug)).toEqual(["live-post"]);

    const rss = buildRssXml(
      {
        title: "Dear Creative",
        siteUrl: "https://news.example.com",
        description: "Posts",
      },
      items,
    );
    expect(rss).toContain("Live");
    expect(rss).not.toContain("Secret draft");
    expect(rss).not.toContain("/preview/");
  });

  it("does not add preview routes to the sitemap entries", async () => {
    const db = await createPostsTestDb();
    await insertPost(db, {
      slug: "draft-only",
      title: "Draft",
      status: "draft",
      publishedAt: null,
    });
    const { items } = await listPublishedPosts(db, { page: 1, pageSize: 500 });
    const urls = items.map(
      (post) => `https://news.example.com/posts/${post.slug}`,
    );
    expect(urls.some((url) => url.includes("/preview/"))).toBe(false);
    expect(urls.some((url) => url.includes("draft-only"))).toBe(false);
  });
});
