import type { PaywallSettings } from "@/components/admin/EditorPaywallSidebar";

/** New posts and editor resets default to public (Free) access. */
export const DEFAULT_PAYWALL_SETTINGS: PaywallSettings = {
  isGated: false,
  gatePriceUsdc: 1.0,
  payoutAddress: "",
  freeContent: "",
  gatedContent: "",
};
