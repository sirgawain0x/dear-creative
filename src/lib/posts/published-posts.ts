import { and, count, desc, eq, isNotNull, lte } from "drizzle-orm";
import type { DearCreativeDb } from "@/db/client";
import { getPostAudioColumns } from "@/db/ensure-schema";
import { authors, posts } from "@/db/schema";
import { mapAuthorRow, type PostAuthorDetail } from "./post-author";
import { resolvePublicPostCoverImage } from "./post-cover-image";
import { buildPublicPostTeaser } from "./post-public-teaser";
import { calculateReadingTime } from "./reading-time";
import { classifyArticleTopic } from "./topic-tagging";
import type { PostMeta } from "./types";
import { bodyHtmlForPublicSurfaces } from "@/lib/paywall/public-body";

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
  author?: PostAuthorDetail | null;
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
  gatedContent?: string | null;
  isGated?: boolean;
  bodyHtml?: string | null;
}): PublishedPostListItem {
  const publicBodyHtml = bodyHtmlForPublicSurfaces({
    isGated: row.isGated ?? false,
    bodyHtml: row.bodyHtml ?? null,
    freeContent: row.freeContent,
    gatedContent: row.gatedContent ?? null,
  });

  const coverImage = resolvePublicPostCoverImage({
    slug: row.slug,
    title: row.title,
    bodyHtml: publicBodyHtml,
  });

  const teaser = buildPublicPostTeaser({
    excerpt: row.teaserText,
    publicPreview: row.freeContent,
  });

  const metrics = calculateReadingTime(publicBodyHtml ?? row.teaserText);
  const topic = classifyArticleTopic({
    title: row.title,
    excerpt: row.teaserText,
    bodyHtml: publicBodyHtml,
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
      gatedContent: posts.gatedContent,
      isGated: posts.isGated,
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
      gatedContent: posts.gatedContent,
      isGated: posts.isGated,
      bodyHtml: posts.bodyHtml,
    })
    .from(posts)
    .where(publishedVisibilityFilter(asOf))
    .orderBy(desc(posts.publishedAt))
    .limit(safeLimit);

  return rows.map(mapListRow);
}

export async function getPublishedPostRowBySlug(
  db: DearCreativeDb,
  slug: string,
  options?: { asOf?: Date },
): Promise<
  | (PublishedPostDetail & {
      postId: string;
      authorId: string | null;
      isGated: boolean;
      freeContent: string | null;
      gatedContent: string | null;
    })
  | null
> {
  const asOf = options?.asOf ?? new Date();
  const [row] = await db
    .select({
      id: posts.id,
      slug: posts.slug,
      title: posts.title,
      publishedAt: posts.publishedAt,
      teaserText: posts.teaserText,
      canonicalUrl: posts.canonicalUrl,
      authorId: posts.authorId,
      freeContent: posts.freeContent,
      gatedContent: posts.gatedContent,
      isGated: posts.isGated,
      bodyHtml: posts.bodyHtml,
      authorName: authors.name,
      authorSlug: authors.slug,
      authorBio: authors.bio,
      authorAvatarUrl: authors.avatarUrl,
      authorMeTokenAddress: authors.meTokenAddress,
      authorMeTokenSymbol: authors.meTokenSymbol,
    })
    .from(posts)
    .leftJoin(authors, eq(posts.authorId, authors.id))
    .where(and(publishedVisibilityFilter(asOf), eq(posts.slug, slug)))
    .limit(1);

  if (!row?.publishedAt) {
    return null;
  }

  const audio = await getPostAudioColumns(db, slug);

  const author =
    row.authorName && row.authorSlug
      ? mapAuthorRow({
          name: row.authorName,
          slug: row.authorSlug,
          bio: row.authorBio,
          avatarUrl: row.authorAvatarUrl,
          meTokenAddress: row.authorMeTokenAddress,
          meTokenSymbol: row.authorMeTokenSymbol,
        })
      : null;

  const listFields = mapListRow({
    slug: row.slug,
    title: row.title,
    publishedAt: row.publishedAt,
    teaserText: row.teaserText,
    canonicalUrl: row.canonicalUrl,
    freeContent: row.freeContent,
    gatedContent: row.gatedContent,
    isGated: row.isGated,
    bodyHtml: row.bodyHtml,
  });

  return {
    ...listFields,
    bodyHtml: row.bodyHtml,
    audioUrl: audio.audioUrl,
    audioVoice: audio.audioVoice,
    author,
    postId: row.id,
    authorId: row.authorId,
    isGated: row.isGated,
    freeContent: row.freeContent,
    gatedContent: row.gatedContent,
  };
}

export async function existsPublishedPostBySlug(
  db: DearCreativeDb,
  slug: string,
  options?: { asOf?: Date },
): Promise<boolean> {
  const asOf = options?.asOf ?? new Date();
  const [row] = await db
    .select({ id: posts.id })
    .from(posts)
    .where(and(publishedVisibilityFilter(asOf), eq(posts.slug, slug)))
    .limit(1);
  return Boolean(row);
}

export async function getPublishedPostBySlug(
  db: DearCreativeDb,
  slug: string,
  options?: { asOf?: Date },
): Promise<PublishedPostDetail | null> {
  const row = await getPublishedPostRowBySlug(db, slug, options);
  if (!row) {
    return null;
  }
  return stripPaywallFieldsFromDetail(row);
}

function stripPaywallFieldsFromDetail(
  row: PublishedPostDetail & {
    postId: string;
    authorId: string | null;
    isGated: boolean;
    freeContent: string | null;
    gatedContent: string | null;
  },
): PublishedPostDetail {
  const detail = { ...row };
  delete (detail as { postId?: string }).postId;
  delete (detail as { authorId?: string | null }).authorId;
  delete (detail as { isGated?: boolean }).isGated;
  delete (detail as { freeContent?: string | null }).freeContent;
  delete (detail as { gatedContent?: string | null }).gatedContent;
  return detail;
}
