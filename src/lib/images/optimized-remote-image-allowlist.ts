import type { RemotePattern } from "next/dist/shared/lib/image-config";

export const GROVE_STORAGE_HOST = "api.grove.storage";

/** Single source of truth for paragraph.xyz paths allowed through the optimizer / cover allowlist. */
export const PARAGRAPH_OPTIMIZED_PATH_RULES = [
  { kind: "prefix" as const, value: "/p/" },
  { kind: "regex" as const, value: /^\/@[^/]+\/.+/ },
] as const;

export const PARAGRAPH_OPTIMIZED_HOST = "paragraph.xyz";

/** Remote patterns for `next.config` — derived from {@link PARAGRAPH_OPTIMIZED_PATH_RULES}. */
export const optimizedImageRemotePatterns: RemotePattern[] = [
  {
    protocol: "https",
    hostname: PARAGRAPH_OPTIMIZED_HOST,
    pathname: "/p/**",
  },
  {
    protocol: "https",
    hostname: PARAGRAPH_OPTIMIZED_HOST,
    pathname: "/@*/**",
  },
];

export function paragraphOptimizedPathAllowed(pathname: string): boolean {
  for (const rule of PARAGRAPH_OPTIMIZED_PATH_RULES) {
    if (rule.kind === "prefix" && pathname.startsWith(rule.value)) {
      return pathname.length > rule.value.length;
    }
    if (rule.kind === "regex" && rule.value.test(pathname)) {
      return true;
    }
  }
  return false;
}

export function isGroveStorageHost(hostname: string): boolean {
  return hostname === GROVE_STORAGE_HOST;
}

export function isAllowlistedCoverImageUrl(url: string): boolean {
  if (url.startsWith("/") || url.startsWith("data:")) {
    return true;
  }
  try {
    const parsed = new URL(url);
    if (isGroveStorageHost(parsed.hostname)) {
      return true;
    }
    if (parsed.hostname === PARAGRAPH_OPTIMIZED_HOST) {
      return paragraphOptimizedPathAllowed(parsed.pathname);
    }
    return false;
  } catch {
    return false;
  }
}

export function shouldBypassImageOptimizer(url: string): boolean {
  if (url.startsWith("data:") || url.startsWith("/")) {
    return true;
  }
  try {
    return isGroveStorageHost(new URL(url).hostname);
  } catch {
    return true;
  }
}
