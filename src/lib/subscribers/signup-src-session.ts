import { sanitizeSignupSrc } from "@/lib/subscribers/signup-src";

export const SIGNUP_SRC_SESSION_KEY = "dear_creative_signup_src";

/** Persist sanitized `src` from a query string (e.g. `window.location.search`). */
export function persistSignupSrcFromSearch(search: string): void {
  if (typeof window === "undefined") {
    return;
  }
  const query = search.startsWith("?") ? search.slice(1) : search;
  const raw = new URLSearchParams(query).get("src");
  if (raw == null) {
    return;
  }
  const sanitized = sanitizeSignupSrc(raw);
  if (sanitized) {
    window.sessionStorage.setItem(SIGNUP_SRC_SESSION_KEY, sanitized);
  }
}

export function readSignupSrcFromSession(): string | null {
  if (typeof window === "undefined") {
    return null;
  }
  return sanitizeSignupSrc(
    window.sessionStorage.getItem(SIGNUP_SRC_SESSION_KEY),
  );
}
