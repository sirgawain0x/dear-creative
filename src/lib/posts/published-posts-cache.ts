import { cacheLife, cacheTag } from "next/cache";
import { getDb } from "@/db/client";
import {
  existsPublishedPostBySlug,
  getPublishedPostBySlug,
  listPublishedPosts,
  publishedPostCacheTag,
} from "./published-posts";

export async function getCachedPublishedPostsPage(page: number) {
  "use cache";
  cacheTag("posts-recent");
  cacheLife("minutes");
  return listPublishedPosts(getDb(), { page });
}

export async function getCachedPublishedPostBySlug(slug: string) {
  "use cache";
  cacheTag("posts-recent", publishedPostCacheTag(slug));
  cacheLife("minutes");
  return getPublishedPostBySlug(getDb(), slug);
}

async function readCachedPublishedPostExists(slug: string): Promise<boolean> {
  "use cache";
  cacheTag("posts-recent", publishedPostCacheTag(slug));
  cacheLife({ revalidate: 60, stale: 60, expire: 600 });
  return existsPublishedPostBySlug(getDb(), slug);
}

/**
 * Cached positive hits only: a cached `false` is never trusted so a newly
 * published slug is visible on the next request without waiting for TTL.
 */
export async function getCachedPublishedPostExists(
  slug: string,
): Promise<boolean> {
  const cached = await readCachedPublishedPostExists(slug);
  if (cached) {
    return true;
  }
  return existsPublishedPostBySlug(getDb(), slug);
}
