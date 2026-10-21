let repurposeEnabledOverride: boolean | undefined;
let repurposePricingOverride: boolean | undefined;

export function setRepurposeEnabledForTests(value: boolean | undefined): void {
  repurposeEnabledOverride = value;
}

export function setRepurposePricingForTests(value: boolean | undefined): void {
  repurposePricingOverride = value;
}

export function isRepurposeEnabled(): boolean {
  if (repurposeEnabledOverride !== undefined) {
    return repurposeEnabledOverride;
  }
  return process.env.REPURPOSE_ENABLED?.trim().toLowerCase() === "true";
}

/** Pricing stub only — no billing logic in v1. Defaults false (charging off). */
export function isRepurposePricingConfigured(): boolean {
  if (repurposePricingOverride !== undefined) {
    return repurposePricingOverride;
  }
  return process.env.REPURPOSE_PRICING?.trim().toLowerCase() === "true";
}
