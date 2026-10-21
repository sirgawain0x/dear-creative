let paywallEnabledOverride: boolean | undefined;

export function setPaywallEnabledForTests(value: boolean | undefined): void {
  paywallEnabledOverride = value;
}

function isPaywallEnvOn(): boolean {
  return process.env.PAYWALL_ENABLED?.trim() === "true";
}

function isPaymentsEnvOnForPaywall(): boolean {
  return process.env.PAYMENTS_ENABLED?.trim() === "true";
}

/** True only when PAYWALL_ENABLED and PAYMENTS_ENABLED are each exactly "true". */
export function isPaywallEnabled(): boolean {
  if (paywallEnabledOverride !== undefined) {
    return paywallEnabledOverride;
  }
  return isPaywallEnvOn() && isPaymentsEnvOnForPaywall();
}
