import { cacheLife, cacheTag } from "next/cache";
import { getDb } from "@/db/client";
import { HOME_SPOTLIGHT_LIMIT } from "./home-spotlight";
import { listRecentPublishedPosts } from "./published-posts";

export async function getCachedHomeSpotlightPosts() {
  "use cache";
  cacheTag("posts-recent");
  cacheLife("minutes");
  return listRecentPublishedPosts(getDb(), HOME_SPOTLIGHT_LIMIT);
}
