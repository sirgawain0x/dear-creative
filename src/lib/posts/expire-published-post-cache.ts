import { revalidateTag } from "next/cache";
import { publishedPostCacheTag } from "./published-posts";

/** Drop proxy/page existence cache for a slug immediately after publish. */
export function expirePublishedPostExistenceCache(slug: string): void {
  revalidateTag(publishedPostCacheTag(slug), "max");
  revalidateTag("posts-recent", "max");
}
