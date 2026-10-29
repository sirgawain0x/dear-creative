/** Repurpose companions may expose full-post-derived material; hide behind paywall. */
export function shouldRenderPostRepurposeSection(showPaywall: boolean): boolean {
  return !showPaywall;
}
