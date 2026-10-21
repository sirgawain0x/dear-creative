let earnEnabledOverride: boolean | undefined;

export function setEarnEnabledForTests(value: boolean | undefined): void {
  earnEnabledOverride = value;
}

export function isEarnEnabled(): boolean {
  if (earnEnabledOverride !== undefined) {
    return earnEnabledOverride;
  }
  return process.env.EARN_ENABLED?.trim() === "true";
}
