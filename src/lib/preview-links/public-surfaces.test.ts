import { describe, expect, it, vi, beforeEach } from "vitest";
import { buildNewsletterEmailContent } from "@/lib/adam/newsletter-email-content";
import {
  buildPostPageMetadata,
  resolvePostOgImageAbsolute,
} from "@/lib/posts/post-page-metadata";
import {
  createPostsTestDb,
  insertPost,
} from "@/lib/posts/test-support/posts-test-db";
import { buildRssXml } from "@/lib/posts/rss-feed";
import { listPublishedPosts } from "@/lib/posts/published-posts";
import { classifyArticleTopic } from "@/lib/posts/topic-tagging";

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

const DRAFT_SECRET = "DRAFT_PREVIEW_LEAK_MARKER_XYZ";
const SITE = "https://news.example.com";

describe("preview drafts stay off public surfaces", () => {
  beforeEach(() => {
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", SITE);
  });

  async function seedDraftAndPublished(db: Awaited<ReturnType<typeof createPostsTestDb>>) {
    await insertPost(db, {
      slug: "draft-with-preview",
      title: "Secret draft",
      status: "draft",
      publishedAt: null,
      bodyHtml: `<p>${DRAFT_SECRET}</p>`,
      teaserText: DRAFT_SECRET,
    });
    await insertPost(db, {
      slug: "live-post",
      title: "Live",
      status: "published",
      publishedAt: new Date("2024-05-01T00:00:00.000Z"),
      bodyHtml: "<p>Public body</p>",
    });
  }

  it("excludes draft posts from RSS and published lists", async () => {
    const db = await createPostsTestDb();
    await seedDraftAndPublished(db);

    const { items } = await listPublishedPosts(db, { page: 1, pageSize: 20 });
    expect(items.map((p) => p.slug)).toEqual(["live-post"]);

    const rss = buildRssXml(
      {
        title: "Dear Creative",
        siteUrl: SITE,
        description: "Posts",
      },
      items,
    );
    expect(rss).toContain("Live");
    expect(rss).not.toContain("Secret draft");
    expect(rss).not.toContain(DRAFT_SECRET);
    expect(rss).not.toContain("/preview/");
  });

  it("does not add preview routes to the sitemap entries", async () => {
    const db = await createPostsTestDb();
    await seedDraftAndPublished(db);
    const { items } = await listPublishedPosts(db, { page: 1, pageSize: 500 });
    const urls = items.map((post) => `${SITE}/posts/${post.slug}`);
    expect(urls.some((url) => url.includes("/preview/"))).toBe(false);
    expect(urls.some((url) => url.includes("draft-with-preview"))).toBe(false);
  });

  it("topic search on the posts index only searches published items", async () => {
    const db = await createPostsTestDb();
    await seedDraftAndPublished(db);
    const { items } = await listPublishedPosts(db, { page: 1, pageSize: 50 });
    const query = DRAFT_SECRET.slice(0, 8).toLowerCase();
    const matches = items.filter(
      (item) =>
        item.title.toLowerCase().includes(query) ||
        (item.excerpt ?? "").toLowerCase().includes(query),
    );
    expect(matches).toHaveLength(0);
  });

  it("newsletter email content for published posts omits draft preview markers", async () => {
    const db = await createPostsTestDb();
    await seedDraftAndPublished(db);
    const { items } = await listPublishedPosts(db, { page: 1, pageSize: 5 });
    const live = items[0]!;
    const email = buildNewsletterEmailContent({
      slug: live.slug,
      canonicalUrl: live.canonicalUrl,
      isGated: false,
      freeContent: null,
      gatedContent: null,
      emailHtml: "<p>Newsletter HTML</p>",
    });
    expect(JSON.stringify(email)).not.toContain(DRAFT_SECRET);
    expect(JSON.stringify(email)).not.toContain("/preview/");
  });

  it("OG metadata for published list items omits draft secrets and preview URLs", async () => {
    const db = await createPostsTestDb();
    await seedDraftAndPublished(db);
    const { items } = await listPublishedPosts(db, { page: 1, pageSize: 5 });
    const live = items[0]!;
    const metadata = buildPostPageMetadata({
      ...live,
      bodyHtml: "<p>Public</p>",
      topic: classifyArticleTopic({
        title: live.title,
        excerpt: live.excerpt,
        bodyHtml: "<p>Public</p>",
      }),
    });
    const ogUrl = resolvePostOgImageAbsolute(
      {
        ...live,
        bodyHtml: "<p>Public</p>",
      },
      SITE,
    );
    const serialized = JSON.stringify({ metadata, ogUrl });
    expect(serialized).not.toContain(DRAFT_SECRET);
    expect(serialized).not.toContain("/preview/");
    expect(metadata.alternates?.canonical).toContain("/posts/live-post");
    expect(ogUrl).toContain("/api/og?");
  });
});
