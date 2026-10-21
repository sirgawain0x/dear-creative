let earnActionsEnabledOverride: boolean | undefined;

export function setEarnActionsEnabledForTests(
  value: boolean | undefined,
): void {
  earnActionsEnabledOverride = value;
}

export function isEarnActionsEnabled(): boolean {
  if (earnActionsEnabledOverride !== undefined) {
    return earnActionsEnabledOverride;
  }
  return process.env.EARN_ACTIONS_ENABLED?.trim() === "true";
}
