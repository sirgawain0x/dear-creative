import {
  isRepurposeNewsletterIncludeType,
  repurposeNewsletterIncludeTypes,
  type RepurposeNewsletterIncludeType,
} from "./types";

export const NEWSLETTER_REPURPOSE_INCLUDES_STORAGE_KEY =
  "dear-creative.newsletter-repurpose-includes";

export function parseNewsletterIncludeTypes(
  values: unknown,
): RepurposeNewsletterIncludeType[] {
  if (!Array.isArray(values)) {
    return [];
  }
  const seen = new Set<RepurposeNewsletterIncludeType>();
  for (const value of values) {
    if (typeof value !== "string") {
      continue;
    }
    if (!isRepurposeNewsletterIncludeType(value)) {
      continue;
    }
    seen.add(value);
  }
  return repurposeNewsletterIncludeTypes.filter((type) => seen.has(type));
}

export function readNewsletterIncludesFromSession(postId: string): RepurposeNewsletterIncludeType[] {
  if (typeof window === "undefined") {
    return [];
  }
  try {
    const raw = window.sessionStorage.getItem(NEWSLETTER_REPURPOSE_INCLUDES_STORAGE_KEY);
    if (!raw) {
      return [];
    }
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    return parseNewsletterIncludeTypes(parsed[postId]);
  } catch {
    return [];
  }
}

export function writeNewsletterIncludesToSession(
  postId: string,
  includes: RepurposeNewsletterIncludeType[],
): void {
  if (typeof window === "undefined") {
    return;
  }
  try {
    const raw = window.sessionStorage.getItem(NEWSLETTER_REPURPOSE_INCLUDES_STORAGE_KEY);
    const parsed = raw ? (JSON.parse(raw) as Record<string, unknown>) : {};
    parsed[postId] = includes;
    window.sessionStorage.setItem(
      NEWSLETTER_REPURPOSE_INCLUDES_STORAGE_KEY,
      JSON.stringify(parsed),
    );
  } catch {
    // ignore quota / private mode
  }
}
