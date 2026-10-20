let cowritersEnabledOverride: boolean | undefined;

export function setCowritersEnabledForTests(value: boolean | undefined): void {
  cowritersEnabledOverride = value;
}

export function isCowritersEnabled(): boolean {
  if (cowritersEnabledOverride !== undefined) {
    return cowritersEnabledOverride;
  }
  return process.env.COWRITERS_ENABLED?.trim().toLowerCase() === "true";
}
