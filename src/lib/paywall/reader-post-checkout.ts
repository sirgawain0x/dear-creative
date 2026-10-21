import type { DearCreativeDb } from "@/db/client";
import { isPaywallEnabled } from "./feature-flag";
import { loadReaderPostUnlockContext } from "./reader-checkout-service";

export async function resolvePostPaywallCheckoutProps(
  db: DearCreativeDb,
  input: {
    slug: string;
    showPaywall: boolean;
  },
) {
  if (!isPaywallEnabled() || !input.showPaywall) {
    return null;
  }

  return loadReaderPostUnlockContext(db, input.slug);
}
