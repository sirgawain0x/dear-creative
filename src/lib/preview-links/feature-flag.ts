let previewLinksEnabledOverride: boolean | undefined;

export function setPreviewLinksEnabledForTests(value: boolean | undefined): void {
  previewLinksEnabledOverride = value;
}

export function isPreviewLinksEnabled(): boolean {
  if (previewLinksEnabledOverride !== undefined) {
    return previewLinksEnabledOverride;
  }
  return process.env.PREVIEW_LINKS_ENABLED?.trim() === "true";
}
