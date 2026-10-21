import { cacheLife, cacheTag } from "next/cache";
import { getDb } from "@/db/client";
import { queryActiveSubscriberCount } from "./active-subscriber-count";
import { ACTIVE_SUBSCRIBER_COUNT_ERROR_CODE } from "./active-subscriber-count";

export async function getCachedActiveSubscriberCount(): Promise<number> {
  "use cache";
  cacheTag("active-subscriber-count");
  cacheLife({ revalidate: 600, stale: 600, expire: 86_400 });
  try {
    return await queryActiveSubscriberCount(getDb());
  } catch (error) {
    console.error(`[${ACTIVE_SUBSCRIBER_COUNT_ERROR_CODE}]`, error);
    return 0;
  }
}
