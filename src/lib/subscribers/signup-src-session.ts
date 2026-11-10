import { sanitizeSignupSrc } from "@/lib/subscribers/signup-src";
import {
  readSignupSrcFromDocumentCookie,
  writeSignupSrcDocumentCookie,
} from "@/lib/subscribers/signup-src-cookie";

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

/** Read attribution for subscribe: sessionStorage first, then cookie. */
export function readSignupSrcForSubscribe(): string | null {
  return readSignupSrcFromSession() ?? readSignupSrcFromDocumentCookie();
}

/** Persist sanitized `src` from a query string when no valid value exists yet. */
export function persistSignupSrcFromSearch(search: string): void {
  const existingSession = readSignupSrcFromSession();
  const existingCookie = readSignupSrcFromDocumentCookie();
  if (existingSession && !existingCookie) {
    writeSignupSrcDocumentCookie(existingSession);
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

  const alreadyStored =
    readSignupSrcFromSession() ?? readSignupSrcFromDocumentCookie();
  if (alreadyStored) {
    return;
  }

  const storage = getSessionStorage();
  if (storage) {
    try {
      storage.setItem(SIGNUP_SRC_SESSION_KEY, sanitized);
    } catch {
      // Storage blocked (private mode, policy, quota, etc.)
    }
  }

  writeSignupSrcDocumentCookie(sanitized);
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
