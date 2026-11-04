import { sanitizeSignupSrc } from "@/lib/subscribers/signup-src";

export const SIGNUP_SRC_SESSION_KEY = "dear_creative_signup_src";

function getSessionStorage(): Storage | null {
  if (typeof window === "undefined") {
    return null;
  }
  try {
    return window.sessionStorage;
  } catch {
    return null;
  }
}

/** Persist sanitized `src` from a query string (e.g. `window.location.search`). */
export function persistSignupSrcFromSearch(search: string): void {
  const storage = getSessionStorage();
  if (!storage) {
    return;
  }
  const query = search.startsWith("?") ? search.slice(1) : search;
  const raw = new URLSearchParams(query).get("src");
  if (raw == null) {
    return;
  }
  const sanitized = sanitizeSignupSrc(raw);
  if (!sanitized) {
    return;
  }
  try {
    storage.setItem(SIGNUP_SRC_SESSION_KEY, sanitized);
  } catch {
    // Storage blocked (private mode, policy, quota, etc.)
  }
}

export function readSignupSrcFromSession(): string | null {
  const storage = getSessionStorage();
  if (!storage) {
    return null;
  }
  try {
    return sanitizeSignupSrc(storage.getItem(SIGNUP_SRC_SESSION_KEY));
  } catch {
    return null;
  }
}
