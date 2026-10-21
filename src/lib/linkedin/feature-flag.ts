let linkedInPostingEnabledOverride: boolean | undefined;

export function setLinkedInPostingEnabledForTests(
  value: boolean | undefined,
): void {
  linkedInPostingEnabledOverride = value;
}

export function isLinkedInPostingEnabled(): boolean {
  if (linkedInPostingEnabledOverride !== undefined) {
    return linkedInPostingEnabledOverride;
  }
  return (
    process.env.LINKEDIN_POSTING_ENABLED?.trim().toLowerCase() === "true"
  );
}
