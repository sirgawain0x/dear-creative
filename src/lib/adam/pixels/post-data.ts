import { and, eq, isNotNull } from "drizzle-orm";
import type { DearCreativeDb } from "@/db/client";
import { posts } from "@/db/schema";
import { getPostAudioColumns } from "@/db/ensure-schema";
import { resolveGroveOrIpfsUrl } from "@/lib/storage/lens-grove";
import { resolvePostCoverImage } from "@/lib/posts/post-cover-image";

export type PixelsPostData = {
  id: string;
  slug: string;
  title: string;
  teaserText: string;
  publishedAt: number;
  audioUrl?: string;
  audioVoice?: string;
  bannerUrls: {
    "16:9": string;
    "1:1": string;
    "21:9"?: string;
  };
  videoUrls: {
    "16:9": string;
    "9:16": string;
  };
  keyQuote?: string;
};

const GROVE_OR_MEDIA_URL =
  /(?:https:\/\/api\.grove\.storage\/[^\s"'<>]+|lens:\/\/[^\s"'<>]+|https?:\/\/[^\s"'<>]+\.(?:mp4|webm)(?:\?[^\s"'<>]*)?)/gi;

function extractMediaUrls(html: string | null | undefined): string[] {
  if (!html?.trim()) {
    return [];
  }
  const matches = html.match(GROVE_OR_MEDIA_URL) ?? [];
  const normalized = matches.map((url) => resolveGroveOrIpfsUrl(url.trim()));
  return [...new Set(normalized.filter(Boolean))];
}

function pickVideoUrls(
  mediaUrls: string[],
): { "16:9": string; "9:16": string } | null {
  const videos = mediaUrls.filter((url) =>
    /\.(mp4|webm)(\?|$)/i.test(url),
  );
  if (videos.length === 0) {
    const groveVideos = mediaUrls.filter((url) =>
      url.includes("api.grove.storage"),
    );
    if (groveVideos.length >= 2) {
      return { "16:9": groveVideos[0], "9:16": groveVideos[1] };
    }
    if (groveVideos.length === 1) {
      return { "16:9": groveVideos[0], "9:16": groveVideos[0] };
    }
    return null;
  }
  if (videos.length === 1) {
    return { "16:9": videos[0], "9:16": videos[0] };
  }
  return { "16:9": videos[0], "9:16": videos[1] };
}

function extractKeyQuote(html: string | null | undefined): string | undefined {
  if (!html?.trim()) {
    return undefined;
  }
  const blockquote = html.match(/<blockquote[^>]*>([\s\S]*?)<\/blockquote>/i);
  if (blockquote?.[1]) {
    return blockquote[1].replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
  }
  return undefined;
}

/** Loads post fields for Pixels clip generation from Turso/SQLite via Drizzle. */
export async function loadPixelsPostDataFromDb(
  db: DearCreativeDb,
  slug: string,
): Promise<PixelsPostData | null> {
  const trimmedSlug = slug.trim();
  if (!trimmedSlug) {
    return null;
  }

  const publishedFilter = and(
    eq(posts.slug, trimmedSlug),
    eq(posts.status, "published"),
    isNotNull(posts.publishedAt),
  );

  const [row] = await db
    .select({
      id: posts.id,
      slug: posts.slug,
      title: posts.title,
      teaserText: posts.teaserText,
      publishedAt: posts.publishedAt,
      bodyHtml: posts.bodyHtml,
      emailHtml: posts.emailHtml,
    })
    .from(posts)
    .where(publishedFilter)
    .limit(1);

  if (!row) {
    return null;
  }

  const audio = await getPostAudioColumns(db, trimmedSlug);
  const bannerMain = resolvePostCoverImage({
    slug: row.slug,
    title: row.title,
    bodyHtml: row.bodyHtml,
    emailHtml: row.emailHtml,
  });
  const mediaUrls = extractMediaUrls(row.bodyHtml ?? row.emailHtml);
  const videoUrls = pickVideoUrls(mediaUrls);
  if (!videoUrls) {
    return null;
  }

  const publishedAtMs = row.publishedAt!.getTime();

  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    teaserText: row.teaserText?.trim() || row.title,
    publishedAt: publishedAtMs,
    audioUrl: audio.audioUrl ?? undefined,
    audioVoice: audio.audioVoice ?? undefined,
    bannerUrls: {
      "16:9": bannerMain,
      "1:1": bannerMain,
    },
    videoUrls,
    keyQuote: extractKeyQuote(row.bodyHtml),
  };
}
