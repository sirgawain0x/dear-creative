let paywallEnabledOverride: boolean | undefined;

export function setPaywallEnabledForTests(value: boolean | undefined): void {
  paywallEnabledOverride = value;
}

/** True only when PAYWALL_ENABLED is exactly the string "true". */
export function isPaywallEnabled(): boolean {
  if (paywallEnabledOverride !== undefined) {
    return paywallEnabledOverride;
  }
  return process.env.PAYWALL_ENABLED?.trim() === "true";
}
