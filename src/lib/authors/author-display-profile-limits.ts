export const AUTHOR_DISPLAY_NAME_MAX_LENGTH = 120;
export const AUTHOR_TAGLINE_MAX_LENGTH = 120;

export type AuthorDisplayProfileFieldError = {
  ok: false;
  error: string;
};

export function validateAuthorDisplayName(
  name: string | undefined,
): { ok: true; value: string } | AuthorDisplayProfileFieldError {
  if (name === undefined) {
    return { ok: false, error: "Display name is required" };
  }
  const trimmed = name.trim();
  if (trimmed.length === 0) {
    return { ok: false, error: "Display name cannot be empty" };
  }
  if (trimmed.length > AUTHOR_DISPLAY_NAME_MAX_LENGTH) {
    return { ok: false, error: "Display name is too long" };
  }
  return { ok: true, value: trimmed };
}

export function validateAuthorTagline(
  tagline: string | null | undefined,
): { ok: true; value: string | null } | AuthorDisplayProfileFieldError {
  if (tagline === undefined) {
    return { ok: true, value: null };
  }
  if (tagline === null) {
    return { ok: true, value: null };
  }
  const trimmed = tagline.trim();
  if (trimmed.length === 0) {
    return { ok: true, value: null };
  }
  if (trimmed.length > AUTHOR_TAGLINE_MAX_LENGTH) {
    return { ok: false, error: "Tagline is too long" };
  }
  return { ok: true, value: trimmed };
}
