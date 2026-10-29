import { describe, expect, it } from "vitest";
import {
  buildPostPageMetadata,
  isGeneratedOgImageUrl,
  resolvePostOgImageAbsolute,
} from "./post-page-metadata";
import type { PublishedPostDetail } from "./published-posts";

const SITE = "https://news.creativeplatform.xyz";

function samplePost(
  overrides: Partial<PublishedPostDetail> = {},
): PublishedPostDetail {
  return {
    slug: "hello-dear-creative",
    title: "Hello, Dear Creative",
    publishedAt: "2026-10-01T12:00:00.000Z",
    excerpt: "Sample excerpt for metadata.",
    canonicalUrl: null,
    coverImage: "/images/hello-dear-creative-banner.jpg",
    readMinutes: 3,
    listenMinutes: 4,
    readingTimeLabel: "3 min read",
    topic: "onchain-culture",
    bodyHtml: "<p>Body</p>",
    isGated: false,
    ...overrides,
  };
}

describe("resolvePostOgImageAbsolute", () => {
  it("uses absolute cover path on the site origin", () => {
    const url = resolvePostOgImageAbsolute(samplePost(), SITE);
    expect(url).toBe(
      `${SITE}/images/hello-dear-creative-banner.jpg`,
    );
    expect(isGeneratedOgImageUrl(url, SITE)).toBe(false);
  });

  it("falls back to the 1200×630 OG route when cover is a data URL", () => {
    const url = resolvePostOgImageAbsolute(
      samplePost({ coverImage: "data:image/svg+xml;utf8,abc" }),
      SITE,
    );
    expect(url).toMatch(
      new RegExp(`^${SITE.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}/api/og\\?`),
    );
    expect(url).toContain("title=");
    expect(isGeneratedOgImageUrl(url, SITE)).toBe(true);
  });
});

describe("buildPostPageMetadata", () => {
  it("sets canonical, open graph, and twitter fields for cover images without OG dimensions", () => {
    const post = samplePost({
      canonicalUrl: "https://custom.example/posts/hello-dear-creative/",
    });
    const metadata = buildPostPageMetadata(post, SITE);

    expect(metadata.alternates?.canonical).toBe(
      "https://custom.example/posts/hello-dear-creative",
    );
    const openGraph = metadata.openGraph as {
      title?: string;
      description?: string;
      type?: string;
      images?: Array<{ url: string; width?: number; height?: number }>;
    };
    const twitter = metadata.twitter as {
      card?: string;
      title?: string;
      description?: string;
      images?: string | string[];
    };

    expect(openGraph.title).toBe(post.title);
    expect(openGraph.description).toBe(post.excerpt);
    expect(openGraph.type).toBe("article");
    expect(openGraph.images?.[0]).toEqual({
      url: `${SITE}/images/hello-dear-creative-banner.jpg`,
      alt: post.title,
    });
    expect(openGraph.images?.[0]?.width).toBeUndefined();
    expect(twitter.card).toBe("summary_large_image");
    expect(twitter.title).toBe(post.title);
    expect(twitter.description).toBe(post.excerpt);
    const twitterImages = Array.isArray(twitter.images)
      ? twitter.images
      : twitter.images
        ? [twitter.images]
        : [];
    expect(twitterImages[0]).toBe(
      `${SITE}/images/hello-dear-creative-banner.jpg`,
    );
  });

  it("includes width and height only for generated /api/og images", () => {
    const metadata = buildPostPageMetadata(
      samplePost({ coverImage: "data:image/svg+xml;utf8,abc" }),
      SITE,
    );
    const openGraph = metadata.openGraph as {
      images?: Array<{ url: string; width?: number; height?: number }>;
    };
    expect(openGraph.images?.[0]).toMatchObject({
      width: 1200,
      height: 630,
    });
    expect(openGraph.images?.[0]?.url).toContain("/api/og?");
  });
});
