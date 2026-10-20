let repurposeEnabledOverride: boolean | undefined;

export function setRepurposeEnabledForTests(value: boolean | undefined): void {
  repurposeEnabledOverride = value;
}

export function isRepurposeEnabled(): boolean {
  if (repurposeEnabledOverride !== undefined) {
    return repurposeEnabledOverride;
  }
  return process.env.REPURPOSE_ENABLED?.trim().toLowerCase() === "true";
}

/** Pricing stub only — no billing logic in v1. */
export function isRepurposePricingConfigured(): boolean {
  return process.env.REPURPOSE_PRICING?.trim().toLowerCase() === "true";
}
