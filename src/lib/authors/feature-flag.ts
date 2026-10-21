let authorProfilesEnabledOverride: boolean | undefined;

export function setAuthorProfilesEnabledForTests(
  value: boolean | undefined,
): void {
  authorProfilesEnabledOverride = value;
}

/** True only when AUTHOR_PROFILES_ENABLED is exactly the string "true". */
export function isAuthorProfilesEnabled(): boolean {
  if (authorProfilesEnabledOverride !== undefined) {
    return authorProfilesEnabledOverride;
  }
  return process.env.AUTHOR_PROFILES_ENABLED?.trim() === "true";
}
