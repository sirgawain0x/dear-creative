import { ACTIVE_SUBSCRIBER_COUNT_ERROR_CODE } from "./active-subscriber-count";
import { getCachedActiveSubscriberCount } from "./cached-active-subscriber-count";

export { ACTIVE_SUBSCRIBER_COUNT_ERROR_CODE };

export async function getPublicActiveSubscriberCount(): Promise<number | null> {
  try {
    const count = await getCachedActiveSubscriberCount();
    if (count <= 0) {
      return null;
    }
    return count;
  } catch (error) {
    console.error(`[${ACTIVE_SUBSCRIBER_COUNT_ERROR_CODE}]`, error);
    return null;
  }
}
