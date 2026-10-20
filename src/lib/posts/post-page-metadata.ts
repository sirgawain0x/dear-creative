import type { Metadata } from "next";
import { getPublicSiteOrigin } from "./recent-feed";
import { resolvePostPublicUrl } from "./post-public-url";
import type { PublishedPostDetail } from "./published-posts";
import { calculateReadingTime } from "./reading-time";
import {
  classifyArticleTopic,
  getTopicLabel,
} from "./topic-tagging";

const DEFAULT_OG_WIDTH = 1200;
const DEFAULT_OG_HEIGHT = 630;
/** Keeps /api/og query strings within practical limits. */
export const MAX_OG_TITLE_QUERY_LENGTH = 120;

export function truncateOgTitle(title: string): string {
  const trimmed = title.trim();
  if (trimmed.length <= MAX_OG_TITLE_QUERY_LENGTH) {
    return trimmed;
  }
  return `${trimmed.slice(0, MAX_OG_TITLE_QUERY_LENGTH - 1)}…`;
}

export function isGeneratedOgImageUrl(imageUrl: string, siteOrigin: string): boolean {
  const prefix = `${siteOrigin.replace(/\/$/, "")}/api/og`;
  return imageUrl.startsWith(`${prefix}?`) || imageUrl.startsWith(`${prefix}/`);
}

/** Absolute URL for Open Graph / Twitter cards (post image or 1200×630 OG route). */
export function resolvePostOgImageAbsolute(
  post: Pick<PublishedPostDetail, "slug" | "title" | "coverImage" | "excerpt" | "bodyHtml" | "publishedAt">,
  siteOrigin: string,
): string {
  const cover = post.coverImage?.trim();
  if (cover) {
    if (cover.startsWith("http://") || cover.startsWith("https://")) {
      return cover;
    }
    if (cover.startsWith("/") && !cover.startsWith("//")) {
      return `${siteOrigin}${cover}`;
    }
  }

  const metrics = calculateReadingTime(post.bodyHtml ?? post.excerpt);
  const topic = classifyArticleTopic({
    title: post.title,
    excerpt: post.excerpt,
    bodyHtml: post.bodyHtml,
  });
  const dateStr = new Date(post.publishedAt).toLocaleDateString("en-US", {
    dateStyle: "medium",
  });

  const ogTitle = truncateOgTitle(post.title);
  const ogPath = `/api/og?title=${encodeURIComponent(
    ogTitle,
  )}&date=${encodeURIComponent(dateStr)}&readTime=${encodeURIComponent(
    metrics.label,
  )}&topic=${encodeURIComponent(getTopicLabel(topic))}`;

  return `${siteOrigin}${ogPath}`;
}

export function buildPostPageMetadata(
  post: PublishedPostDetail,
  siteOrigin: string = getPublicSiteOrigin(),
): Metadata {
  const canonical = resolvePostPublicUrl({
    slug: post.slug,
    canonicalUrl: post.canonicalUrl,
  });
  const description = post.excerpt ?? undefined;
  const ogImageUrl = resolvePostOgImageAbsolute(post, siteOrigin);
  const generatedOg = isGeneratedOgImageUrl(ogImageUrl, siteOrigin);

  const openGraphImage = generatedOg
    ? {
        url: ogImageUrl,
        width: DEFAULT_OG_WIDTH,
        height: DEFAULT_OG_HEIGHT,
        alt: post.title,
      }
    : {
        url: ogImageUrl,
        alt: post.title,
      };

  return {
    title: `${post.title} — Dear Creative`,
    description,
    alternates: {
      canonical,
    },
    openGraph: {
      title: post.title,
      description,
      type: "article",
      url: canonical,
      publishedTime: post.publishedAt,
      images: [openGraphImage],
    },
    twitter: {
      card: "summary_large_image",
      title: post.title,
      description,
      images: [ogImageUrl],
    },
    other: {
      "fc:frame": "vNext",
      "fc:frame:image": ogImageUrl,
    },
  };
}
