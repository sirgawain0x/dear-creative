import { afterEach, describe, expect, it } from "vitest";
import { buildPostPageMetadata } from "@/lib/posts/post-page-metadata";
import { buildRssXml } from "@/lib/posts/rss-feed";
import { listRecentPublishedPosts } from "@/lib/posts/published-posts";
import {
  createPostsTestDb,
  insertPost,
} from "@/lib/posts/test-support/posts-test-db";
import { shouldRenderPostRepurposeSection } from "@/lib/posts/post-repurpose-visibility";
import { setPaywallEnabledForTests } from "./feature-flag";
import {
  applyReaderBodyToPost,
  type PublishedPostWithPaywallFields,
} from "./reader-post";

const GATED_SECRET = "SECRET_GATED_LEAK_MARKER_XYZ";

describe("paywall leak surfaces", () => {
  afterEach(() => {
    setPaywallEnabledForTests(undefined);
  });

  function gatedRow(
    overrides: Partial<PublishedPostWithPaywallFields> = {},
  ): PublishedPostWithPaywallFields {
    return {
      slug: "gated-leak",
      title: "Gated Leak Test",
      publishedAt: "2026-01-01T00:00:00.000Z",
      canonicalUrl: null,
      excerpt: "Teaser",
      teaser: "Teaser",
      coverImage: "/images/default.png",
      readMinutes: 1,
      listenMinutes: 1,
      readingTimeLabel: "1 min read",
      topic: "ai-ownership",
      bodyHtml: `<p>Free</p><p>${GATED_SECRET}</p>`,
      audioUrl: null,
      audioVoice: null,
      author: null,
      postId: "post-1",
      authorId: "writer-1",
      isGated: true,
      freeContent: "Free preview paragraph.",
      gatedContent: GATED_SECRET,
      ...overrides,
    };
  }

  it("strips gated_content from unpaid reader HTML payload", () => {
    setPaywallEnabledForTests(true);
    const post = applyReaderBodyToPost(gatedRow(), false);
    expect(post.bodyHtml).toContain("Free preview");
    expect(JSON.stringify(post)).not.toContain(GATED_SECRET);
    expect(shouldRenderPostRepurposeSection(true)).toBe(false);
  });

  it("keeps flag-off behavior unchanged (full bodyHtml)", () => {
    setPaywallEnabledForTests(false);
    const post = applyReaderBodyToPost(gatedRow(), false);
    expect(post.bodyHtml).toContain(GATED_SECRET);
  });

  it("metadata and RSS omit gated markers for public feeds", async () => {
    setPaywallEnabledForTests(true);
    const publicPost = applyReaderBodyToPost(gatedRow(), false);
    const metadata = buildPostPageMetadata(publicPost);
    const metadataJson = JSON.stringify(metadata);
    expect(metadataJson).not.toContain(GATED_SECRET);

    const rss = buildRssXml(
      {
        title: "Dear Creative",
        siteUrl: "https://news.example.com",
        description: "Test",
      },
      [
        {
          slug: publicPost.slug,
          title: publicPost.title,
          publishedAt: publicPost.publishedAt,
          excerpt: publicPost.excerpt,
          teaser: publicPost.teaser,
          canonicalUrl: publicPost.canonicalUrl,
          coverImage: publicPost.coverImage,
          readMinutes: publicPost.readMinutes,
          listenMinutes: publicPost.listenMinutes,
          readingTimeLabel: publicPost.readingTimeLabel,
          topic: publicPost.topic,
        },
      ],
    );
    expect(rss).not.toContain(GATED_SECRET);
  });

  it("list queries do not expose gated bodyHtml in serialized items", async () => {
    setPaywallEnabledForTests(true);
    const db = await createPostsTestDb();
    await insertPost(db, {
      slug: "list-gated",
      title: "List Gated",
      status: "published",
      publishedAt: new Date(),
      isGated: true,
      freeContent: "Only free list preview.",
      gatedContent: GATED_SECRET,
      bodyHtml: `<p>Only free list preview.</p><p>${GATED_SECRET}</p>`,
    });

    const [item] = await listRecentPublishedPosts(db, 1);
    expect(item).toBeDefined();
    expect(item).not.toHaveProperty("bodyHtml");
    expect(JSON.stringify(item)).not.toContain(GATED_SECRET);
  });

  it("sitemap builder uses list items without gated body (smoke)", async () => {
    setPaywallEnabledForTests(true);
    const db = await createPostsTestDb();
    await insertPost(db, {
      slug: "sitemap-gated",
      title: "Sitemap Gated",
      status: "published",
      publishedAt: new Date(),
      isGated: true,
      freeContent: "Free",
      gatedContent: GATED_SECRET,
      bodyHtml: `<p>Free</p><p>${GATED_SECRET}</p>`,
    });
    const items = await listRecentPublishedPosts(db, 5);
    const xml = items
      .map((post) => `<loc>https://news.example.com/posts/${post.slug}</loc>`)
      .join("");
    expect(xml).toContain("sitemap-gated");
    expect(xml).not.toContain(GATED_SECRET);
  });
});
