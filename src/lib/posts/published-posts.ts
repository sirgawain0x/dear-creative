import { and, count, desc, eq, isNotNull, lte } from "drizzle-orm";
import type { DearCreativeDb } from "@/db/client";
import { getPostAudioColumns } from "@/db/ensure-schema";
import { posts } from "@/db/schema";
import { resolvePublicPostCoverImage } from "./post-cover-image";
import { buildPublicPostTeaser } from "./post-public-teaser";
import { calculateReadingTime } from "./reading-time";
import { classifyArticleTopic } from "./topic-tagging";
import type { PostMeta } from "./types";

export const DEFAULT_PUBLISHED_PAGE_SIZE = 20;

export function publishedVisibilityFilter(asOf: Date = new Date()) {
  return and(
    eq(posts.status, "published"),
    isNotNull(posts.publishedAt),
    lte(posts.publishedAt, asOf),
  );
}

export type PublishedPostListItem = PostMeta & {
  canonicalUrl: string | null;
};

export type PublishedPostDetail = PublishedPostListItem & {
  bodyHtml: string | null;
  audioUrl?: string | null;
  audioVoice?: string | null;
};

export type PublishedPostsPage = {
  items: PublishedPostListItem[];
  page: number;
  pageSize: number;
  totalCount: number;
  totalPages: number;
};

function toIsoPublishedAt(value: Date): string {
  return value.toISOString();
}

function mapListRow(row: {
  slug: string;
  title: string;
  publishedAt: Date | null;
  teaserText: string | null;
  canonicalUrl: string | null;
  freeContent: string | null;
  bodyHtml?: string | null;
}): PublishedPostListItem {
  const coverImage = resolvePublicPostCoverImage({
    slug: row.slug,
    title: row.title,
    bodyHtml: row.bodyHtml,
  });

  const teaser = buildPublicPostTeaser({
    excerpt: row.teaserText,
    publicPreview: row.freeContent,
  });

  const metrics = calculateReadingTime(row.bodyHtml ?? row.teaserText);
  const topic = classifyArticleTopic({
    title: row.title,
    excerpt: row.teaserText,
    bodyHtml: row.bodyHtml,
  });

  return {
    slug: row.slug,
    title: row.title,
    publishedAt: toIsoPublishedAt(row.publishedAt as Date),
    excerpt: row.teaserText ?? undefined,
    teaser,
    canonicalUrl: row.canonicalUrl,
    coverImage,
    readMinutes: metrics.readMinutes,
    listenMinutes: metrics.listenMinutes,
    readingTimeLabel: metrics.label,
    topic,
  };
}

export function publishedPostCacheTag(slug: string): string {
  return `post:${slug}`;
}

export async function countPublishedPosts(
  db: DearCreativeDb,
  options?: { asOf?: Date },
): Promise<number> {
  const asOf = options?.asOf ?? new Date();
  const [row] = await db
    .select({ total: count() })
    .from(posts)
    .where(publishedVisibilityFilter(asOf));
  return row?.total ?? 0;
}

export async function listPublishedPosts(
  db: DearCreativeDb,
  options?: { page?: number; pageSize?: number; asOf?: Date },
): Promise<PublishedPostsPage> {
  const asOf = options?.asOf ?? new Date();
  const pageSize = options?.pageSize ?? DEFAULT_PUBLISHED_PAGE_SIZE;
  const page = Math.max(1, options?.page ?? 1);
  const totalCount = await countPublishedPosts(db, { asOf });
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
  const safePage = Math.min(page, totalPages);
  const offset = (safePage - 1) * pageSize;

  const rows = await db
    .select({
      slug: posts.slug,
      title: posts.title,
      publishedAt: posts.publishedAt,
      teaserText: posts.teaserText,
      canonicalUrl: posts.canonicalUrl,
      freeContent: posts.freeContent,
      bodyHtml: posts.bodyHtml,
    })
    .from(posts)
    .where(publishedVisibilityFilter(asOf))
    .orderBy(desc(posts.publishedAt))
    .limit(pageSize)
    .offset(offset);

  return {
    items: rows.map(mapListRow),
    page: safePage,
    pageSize,
    totalCount,
    totalPages,
  };
}

export async function listRecentPublishedPosts(
  db: DearCreativeDb,
  limit: number,
  options?: { asOf?: Date },
): Promise<PublishedPostListItem[]> {
  const asOf = options?.asOf ?? new Date();
  const safeLimit = Math.min(Math.max(limit, 1), 100);
  const rows = await db
    .select({
      slug: posts.slug,
      title: posts.title,
      publishedAt: posts.publishedAt,
      teaserText: posts.teaserText,
      canonicalUrl: posts.canonicalUrl,
      freeContent: posts.freeContent,
      bodyHtml: posts.bodyHtml,
    })
    .from(posts)
    .where(publishedVisibilityFilter(asOf))
    .orderBy(desc(posts.publishedAt))
    .limit(safeLimit);

  return rows.map(mapListRow);
}

export async function getPublishedPostBySlug(
  db: DearCreativeDb,
  slug: string,
  options?: { asOf?: Date },
): Promise<PublishedPostDetail | null> {
  const asOf = options?.asOf ?? new Date();
  const [row] = await db
    .select({
      slug: posts.slug,
      title: posts.title,
      publishedAt: posts.publishedAt,
      teaserText: posts.teaserText,
      canonicalUrl: posts.canonicalUrl,
      freeContent: posts.freeContent,
      bodyHtml: posts.bodyHtml,
    })
    .from(posts)
    .where(and(publishedVisibilityFilter(asOf), eq(posts.slug, slug)))
    .limit(1);

  if (!row?.publishedAt) {
    return null;
  }

  const audio = await getPostAudioColumns(db, slug);

  return {
    ...mapListRow({
      slug: row.slug,
      title: row.title,
      publishedAt: row.publishedAt,
      teaserText: row.teaserText,
      canonicalUrl: row.canonicalUrl,
      freeContent: row.freeContent,
      bodyHtml: row.bodyHtml,
    }),
    bodyHtml: row.bodyHtml,
    audioUrl: audio.audioUrl,
    audioVoice: audio.audioVoice,
  };
}
