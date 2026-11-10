import { sanitizeSignupSrc } from "@/lib/subscribers/signup-src";

export const SIGNUP_SRC_COOKIE_NAME = "dc_signup_src";

export const SIGNUP_SRC_COOKIE_MAX_AGE_SECONDS = 2_592_000;

/** Parse `dc_signup_src` from a `Cookie` header or `document.cookie` string. */
export function readSignupSrcFromCookieHeader(
  cookieHeader: string | null | undefined,
): string | null {
  if (cookieHeader == null || cookieHeader === "") {
    return null;
  }
  const parts = cookieHeader.split(";");
  for (const part of parts) {
    const trimmed = part.trim();
    if (!trimmed.startsWith(`${SIGNUP_SRC_COOKIE_NAME}=`)) {
      continue;
    }
    const raw = trimmed.slice(SIGNUP_SRC_COOKIE_NAME.length + 1);
    let decoded = raw;
    try {
      decoded = decodeURIComponent(raw);
    } catch {
      decoded = raw;
    }
    return sanitizeSignupSrc(decoded);
  }
  return null;
}

export function readSignupSrcFromDocumentCookie(): string | null {
  if (typeof document === "undefined") {
    return null;
  }
  try {
    return readSignupSrcFromCookieHeader(document.cookie);
  } catch {
    return null;
  }
}

/** Set first-party attribution cookie; never overwrites an existing valid value. */
export function writeSignupSrcDocumentCookie(value: string): void {
  if (typeof document === "undefined") {
    return;
  }
  if (readSignupSrcFromDocumentCookie()) {
    return;
  }
  const sanitized = sanitizeSignupSrc(value);
  if (!sanitized) {
    return;
  }
  try {
    const encoded = encodeURIComponent(sanitized);
    const secure =
      typeof location !== "undefined" && location.protocol === "https:"
        ? "; Secure"
        : "";
    document.cookie = `${SIGNUP_SRC_COOKIE_NAME}=${encoded}; Path=/; SameSite=Lax${secure}; Max-Age=${SIGNUP_SRC_COOKIE_MAX_AGE_SECONDS}`;
  } catch {
    // Cookie blocked or quota
  }
}
