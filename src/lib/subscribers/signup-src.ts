export const SIGNUP_SRC_MAX_LENGTH = 32;

const SIGNUP_SRC_RE = /^[a-z0-9-]+$/;

/** Lowercase `[a-z0-9-]` only, max 32 chars; invalid input becomes null. */
export function sanitizeSignupSrc(
  raw: string | null | undefined,
): string | null {
  if (raw == null) {
    return null;
  }
  const trimmed = raw.trim();
  if (!trimmed) {
    return null;
  }
  const lowered = trimmed.toLowerCase();
  let filtered = "";
  for (const char of lowered) {
    if (
      (char >= "a" && char <= "z") ||
      (char >= "0" && char <= "9") ||
      char === "-"
    ) {
      filtered += char;
    }
  }
  if (!filtered) {
    return null;
  }
  const truncated =
    filtered.length > SIGNUP_SRC_MAX_LENGTH
      ? filtered.slice(0, SIGNUP_SRC_MAX_LENGTH)
      : filtered;
  return SIGNUP_SRC_RE.test(truncated) ? truncated : null;
}
