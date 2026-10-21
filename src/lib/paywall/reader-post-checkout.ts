import type { DearCreativeDb } from "@/db/client";
import { isPaywallEnabled } from "./feature-flag";
import {
  loadActiveReaderSubscriptionSummary,
  loadReaderCheckoutContext,
} from "./reader-checkout-service";
import { resolvePostViewerFromCookies } from "./viewer-from-cookies";
import type { CookieReader } from "@/lib/privy/session-from-cookies";

export async function resolvePostPaywallCheckoutProps(
  db: DearCreativeDb,
  input: {
    slug: string;
    showPaywall: boolean;
    authorId: string | null;
    readCookie: CookieReader;
  },
) {
  if (!isPaywallEnabled() || !input.showPaywall) {
    return null;
  }

  const context = await loadReaderCheckoutContext(db, input.slug);
  if (!context) {
    return null;
  }

  const viewer = await resolvePostViewerFromCookies(db, input.readCookie);
  const subscriptionSummary =
    viewer && input.authorId
      ? await loadActiveReaderSubscriptionSummary(db, {
          privyUserId: viewer.privyUserId,
          writerId: input.authorId,
        })
      : null;

  return {
    ...context,
    subscriptionSummary,
  };
}
