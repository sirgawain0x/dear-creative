/** Max slug length aligned with public post URLs and proxy guardrails. */
export const POST_SLUG_MAX_LENGTH = 100;

/** Lowercase letters, digits, and single hyphens between segments. */
export const POST_SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export function isWellFormedPostSlug(slug: string): boolean {
  if (slug.length === 0 || slug.length > POST_SLUG_MAX_LENGTH) {
    return false;
  }
  return POST_SLUG_PATTERN.test(slug);
}
