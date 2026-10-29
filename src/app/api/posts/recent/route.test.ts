import { describe, expect, it, vi } from "vitest";
import {
  createPostsTestDb,
  insertPost,
} from "@/lib/posts/test-support/posts-test-db";
import { setPaywallEnabledForTests } from "@/lib/paywall/feature-flag";

vi.mock("next/cache", () => ({
  unstable_cache: (fn: () => Promise<unknown>) => async () => fn(),
}));

const { getDb } = vi.hoisted(() => ({
  getDb: vi.fn(),
}));

vi.mock("@/db/client", () => ({
  getDb,
}));

describe("/api/posts/recent payload shape", () => {
  it("matches Creative TV feed fields from Turso published posts", async () => {
    const db = await createPostsTestDb();
    getDb.mockReturnValue(db);
    await insertPost(db, {
      slug: "creative-tv-post",
      title: "On chain",
      status: "published",
      publishedAt: new Date("2024-06-01T00:00:00.000Z"),
      teaserText: "Teaser",
      canonicalUrl: "https://paragraph.xyz/p/creative-tv-post",
    });

    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://news.creativeplatform.xyz");
    const { buildRecentPosts } = await import("@/lib/posts/recent-feed");
    const posts = await buildRecentPosts(6);
    expect(posts).toHaveLength(1);
    for (const post of posts) {
      expect(post).toMatchObject({
        slug: expect.any(String),
        title: expect.any(String),
        publishedAt: expect.any(String),
        canonicalUrl: expect.stringMatching(/^https:\/\//),
      });
    }
    expect(posts[0]?.canonicalUrl).toBe(
      "https://paragraph.xyz/p/creative-tv-post",
    );
    expect(posts[0]?.x402Url).toBe(
      "https://news.creativeplatform.xyz/api/posts/creative-tv-post/full",
    );
    expect(posts[0]?.isGated).toBe(false);
  });

  it("includes isGated true for paid posts without leaking gated body", async () => {
    setPaywallEnabledForTests(true);
    const db = await createPostsTestDb();
    getDb.mockReturnValue(db);
    const secret = "GATED_RECENT_API_LEAK_MARKER";
    await insertPost(db, {
      slug: "paid-recent",
      title: "Paid Recent",
      status: "published",
      publishedAt: new Date("2024-06-01T00:00:00.000Z"),
      isGated: true,
      freeContent: "Free teaser only",
      gatedContent: secret,
      bodyHtml: `<p>Free teaser only</p><p>${secret}</p>`,
    });

    const { buildRecentPosts } = await import("@/lib/posts/recent-feed");
    const posts = await buildRecentPosts(6);
    expect(posts).toHaveLength(1);
    expect(posts[0]?.isGated).toBe(true);
    expect(JSON.stringify(posts[0])).not.toContain(secret);
    setPaywallEnabledForTests(undefined);
  });
});
